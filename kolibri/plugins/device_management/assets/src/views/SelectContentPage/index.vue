<template>

  <div>
    <ContentWizardUiAlert
      v-if="wholePageError"
      :errorType="wholePageError"
    />

    <template v-else>
      <TaskProgress
        v-if="showUpdateProgressBar"
        id="updatingchannel"
        type="UPDATING_CHANNEL"
        status="QUEUED"
        :percentage="0"
        :showButtons="true"
        :cancellable="true"
        @cleartask="cancelUpdateChannel()"
      />
      <TaskProgress
        v-else-if="metadataDownloadTask"
        type="DOWNLOADING_CHANNEL_CONTENTS"
        v-bind="metadataDownloadTask"
        :showButtons="true"
        :cancellable="true"
        @cleartask="returnToChannelsList()"
      />

      <template v-if="mainAreaIsVisible">
        <section class="notifications">
          <UiAlert
            v-if="newVersionAvailable"
            type="info"
            :removeIcon="true"
            :dismissible="false"
          >
            {{ $tr('newVersionAvailableNotification') }}
          </UiAlert>
        </section>
        <section
          v-if="transferredChannel && onDeviceInfoIsReady"
          class="updates"
        >
          <div
            v-if="newVersionAvailable"
            class="updates-available"
          >
            <span>
              {{ $tr('newVersionAvailable', { version: transferredChannel.version }) }}
            </span>
            <KButton
              :text="$tr('update')"
              :primary="true"
              name="update"
              @click="updateChannelMetadata()"
            />
          </div>
          <span v-else>{{ $tr('channelUpToDate') }}</span>
        </section>
        <ChannelContentsSummary
          :channel="transferredChannel"
          :channelOnDevice="channelOnDevice"
        />

        <UiAlert
          v-if="status !== ''"
          type="error"
          :dismissible="false"
        >
          {{ $tr('problemFetchingChannel') }}
        </UiAlert>

        <UiAlert
          v-if="contentTransferError"
          type="error"
          :dismissible="false"
        >
          {{ $tr('problemTransferringContents') }}
        </UiAlert>
        <!-- Contains size estimates + submit button -->
        <SelectedResourcesSize
          v-if="availableSpace !== null"
          :mode="mode"
          :fileSize="nodeCounts.fileSize"
          :resourceCount="nodeCounts.resources"
          :spaceOnDrive="availableSpace"
          @clickconfirm="startContentTransfer()"
        />
        <hr>
        <ContentTreeViewer />
      </template>
    </template>
  </div>

</template>


<script>

  import { mapState, mapActions, mapMutations, mapGetters } from 'vuex';
  import KButton from 'kolibri.coreVue.components.KButton';
  import UiAlert from 'keen-ui/src/UiAlert';
  import { TaskResource } from 'kolibri.resources';
  import isEmpty from 'lodash/isEmpty';
  import find from 'lodash/find';
  import TaskProgress from '../ManageContentPage/TaskProgress';
  import { ContentWizardErrors, TaskStatuses, TaskTypes } from '../../constants';
  import { manageContentPageLink } from '../ManageContentPage/manageContentLinks';
  import { downloadChannelMetadata } from '../../modules/wizard/utils';
  import ChannelContentsSummary from './ChannelContentsSummary';
  import ContentTreeViewer from './ContentTreeViewer';
  import SelectedResourcesSize from './SelectedResourcesSize';
  import ContentWizardUiAlert from './ContentWizardUiAlert';

  export default {
    name: 'SelectContentPage',
    metaInfo() {
      return {
        title: this.$tr('selectContent', { channelName: this.transferredChannel.name }),
      };
    },
    components: {
      ChannelContentsSummary,
      ContentTreeViewer,
      ContentWizardUiAlert,
      KButton,
      SelectedResourcesSize,
      TaskProgress,
      UiAlert,
    },
    data() {
      return {
        showUpdateProgressBar: false,
        contentTransferError: false,
        pageWillRefresh: false,
        // need to store ID in component to make sure cancellation works properly
        // in beforeDestroy
        metadataDownloadTaskId: '',
      };
    },
    computed: {
      ...mapGetters('manageContent', ['channelIsInstalled']),
      ...mapGetters('manageContent/wizard', ['nodeTransferCounts']),
      ...mapState('manageContent', ['taskList']),
      ...mapState('manageContent/wizard', [
        'availableSpace',
        'currentTopicNode',
        'status',
        'transferType',
        'transferredChannel',
      ]),
      mode() {
        return this.transferType === 'localexport' ? 'export' : 'import';
      },
      mainAreaIsVisible() {
        // Don't show main area if page is about to refresh after updating (or cancelling update)
        if (this.pageWillRefresh) {
          return false;
        }
        return !this.taskInProgress && this.onDeviceInfoIsReady;
      },
      onDeviceInfoIsReady() {
        return !isEmpty(this.currentTopicNode);
      },
      metadataDownloadTask() {
        return find(this.taskList, { type: TaskTypes.REMOTECHANNELIMPORT });
      },
      contentDownloadTask() {
        return find(this.taskList, { type: TaskTypes.REMOTECONTENTIMPORT });
      },
      // If this property is truthy, the entire UI is hidden and only the UiAlert is shown
      wholePageError() {
        // Show error if a Channel Transfer is in progress
        if (this.contentDownloadTask) {
          return ContentWizardErrors.TRANSFER_IN_PROGRESS;
        }
        // Show errors thrown during data fetching
        if (Object.values(ContentWizardErrors).includes(this.status)) {
          return this.status;
        }
      },
      channelOnDevice() {
        return this.channelIsInstalled(this.transferredChannel.id) || {};
      },
      newVersionAvailable() {
        return this.transferredChannel.version > this.channelOnDevice.version;
      },
      taskInProgress() {
        return this.taskList[0] && this.taskList[0].status !== TaskStatuses.COMPLETED;
      },
      nodeCounts() {
        return this.nodeTransferCounts(this.transferType);
      },
    },
    watch: {
      metadataDownloadTask(val) {
        if (val) {
          this.metadataDownloadTaskId = val.id;
        } else {
          this.metadataDownloadTaskId = '';
        }
      },
      transferredChannel(val) {
        if (val.name) {
          this.setAppBarTitle(this.$tr('selectContent', { channelName: val.name }));
        }
      },
    },
    mounted() {
      if (this.wholePageError) {
        this.setAppBarTitle(this.$tr('pageLoadError'));
      } else {
        this.setAppBarTitle(
          this.$tr('selectContent', { channelName: this.transferredChannel.name })
        );
      }
    },
    beforeDestroy() {
      this.cancelMetadataDownloadTask();
    },
    methods: {
      ...mapMutations('coreBase', {
        setAppBarTitle: 'SET_APP_BAR_TITLE',
      }),
      ...mapActions('manageContent/wizard', ['transferChannelContent']),
      downloadChannelMetadata,
      cancelUpdateChannel() {
        this.showUpdateProgressBar = false;
        this.cancelMetadataDownloadTask().then(this.refreshPage);
      },
      cancelMetadataDownloadTask() {
        if (this.metadataDownloadTaskId) {
          return TaskResource.cancelTask(this.metadataDownloadTaskId);
        }
        return Promise.resolve();
      },
      updateChannelMetadata() {
        // NOTE: This only updates the metadata, not the underlying content.
        // This could produced unexpected behavior for users.
        this.showUpdateProgressBar = true;
        this.pageWillRefresh = true;
        return this.downloadChannelMetadata(this.$store)
          .then(() => this.refreshPage())
          .catch(error => {
            if (error.errorType !== 'CHANNEL_TASK_ERROR') {
              this.contentTransferError = true;
            }
          });
      },
      startContentTransfer() {
        this.contentTransferError = false;
        return this.transferChannelContent()
          .then(() => {
            this.returnToChannelsList();
          })
          .catch(() => {
            this.contentTransferError = true;
          });
      },
      refreshPage() {
        this.$router.go(this.$router.currentRoute);
      },
      returnToChannelsList() {
        this.$router.push(manageContentPageLink());
      },
    },
    $trs: {
      channelUpToDate: 'Channel up-to-date',
      pageLoadError: 'There was a problem loading this page…',
      newVersionAvailable: 'Version {version, number} available',
      newVersionAvailableNotification:
        'New channel version available. Some of your files may be outdated or deleted.',
      problemFetchingChannel: 'There was a problem getting the contents of this channel',
      problemTransferringContents: 'There was a problem transferring the selected contents',
      selectContent: "Select content from '{channelName}'",
      update: 'Update',
    },
  };

</script>


<style lang="scss" scoped>

  .updates {
    text-align: right;
  }

</style>
