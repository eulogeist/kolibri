<template>

  <CoreBase
    :immersivePage="false"
    :authorized="userIsAuthorized"
    authorizedRole="adminOrCoach"
    :showSubNav="true"
  >

    <TopNavbar slot="sub-nav" />

    <KPageContainer>
      <p>
        <BackLink
          :to="classRoute('ReportsLearnerReportPage')"
          :text="learner.name"
        />
      </p>
      <h1>
        <KLabeledIcon>
          <KIcon slot="icon" lesson />
          {{ lesson.title }}
        </KLabeledIcon>
      </h1>
      <HeaderTable>
        <HeaderTableRow>
          <template slot="key">{{ coachStrings.$tr('statusLabel') }}</template>
          <template slot="value"><LessonActive :active="true" /></template>
        </HeaderTableRow>
        <!-- TODO COACH
        <HeaderTableRow>
          <template slot="key">{{ coachStrings.$tr('descriptionLabel') }}</template>
          <template slot="value">Ipsum lorem</template>
        </HeaderTableRow>
         -->
      </HeaderTable>

      <CoreTable>
        <thead slot="thead">
          <tr>
            <th>{{ coachStrings.$tr('titleLabel') }}</th>
            <th>{{ coachStrings.$tr('progressLabel') }}</th>
            <th>{{ coachStrings.$tr('timeSpentLabel') }}</th>
          </tr>
        </thead>
        <transition-group slot="tbody" tag="tbody" name="list">
          <tr v-for="tableRow in table" :key="tableRow.node_id">
            <td>
              <KLabeledIcon>
                <KBasicContentIcon slot="icon" :kind="tableRow.kind" />
                <KRouterLink
                  v-if="tableRow.kind === 'exercise'"
                  :text="tableRow.title"
                  :to="classRoute(
                    'ReportsLearnerReportLessonExercisePage',
                    { exerciseId: tableRow.content_id }
                  )"
                />
                <template v-else>
                  {{ tableRow.title }}
                </template>
              </KLabeledIcon>
            </td>
            <td>
              <StatusSimple :status="tableRow.statusObj.status" />
            </td>
            <td>
              <TimeDuration :seconds="tableRow.statusObj.time_spent" />
            </td>
          </tr>
        </transition-group>
      </CoreTable>
    </KPageContainer>
  </CoreBase>

</template>


<script>

  import commonCoach from '../common';

  export default {
    name: 'ReportsLearnerReportLessonPage',
    components: {},
    mixins: [commonCoach],
    computed: {
      lesson() {
        return this.lessonMap[this.$route.params.lessonId];
      },
      learner() {
        return this.learnerMap[this.$route.params.learnerId];
      },
      table() {
        const contentArray = this.lesson.node_ids.map(node_id => this.contentNodeMap[node_id]);
        const sorted = this._.sortBy(contentArray, ['title']);
        const mapped = sorted.map(content => {
          const tableRow = {
            statusObj: this.getContentStatusObjForLearner(content.content_id, this.learner.id),
          };
          Object.assign(tableRow, content);
          return tableRow;
        });
        return mapped;
      },
    },
    $trs: {
      lessonProgressLabel: "'{lesson}' progress",
    },
  };

</script>


<style lang="scss" scoped></style>
