<!--
This template is intended to act as the default wrapper for assessment focused rendering
plugins.

As such, it provides display of current mastery progress, and manages all mastery/attempt log
oriented data synchronization.
-->


<template v-if="ready">

  <div>
    <UiAlert v-if="itemError" :dismissible="false" type="error">
      {{ $tr('itemError') }}
      <KButton
        appearance="basic-link"
        :text="$tr('tryDifferentQuestion')"
        @click="nextQuestion"
      />
    </UiAlert>
    <div>
      <ContentRenderer
        :id="id"
        ref="contentRenderer"
        :kind="kind"
        :lang="lang"
        :files="files"
        :contentId="contentId"
        :channelId="channelId"
        :available="available"
        :extraFields="extraFields"
        :assessment="true"
        :itemId="itemId"
        :initSession="initSession"
        @answerGiven="answerGiven"
        @hintTaken="hintTaken"
        @sessionInitialized="sessionInitialized"
        @itemError="handleItemError"
        @startTracking="startTracking"
        @stopTracking="stopTracking"
        @updateProgress="updateProgress"
        @updateContentState="updateContentState"
      />
    </div>

    <div
      class="attempts-container"
      :class="{ 'mobile': windowIsSmall }"
      :style="{ backgroundColor: $coreBgLight }"
    >
      <div class="margin-wrapper">
        <div class="overall-status" :style="{ color: $coreTextDefault }">
          <mat-svg
            name="stars"
            category="action"
            :style="{
              fill: success ? $coreStatusMastered : $coreGrey,
              verticalAlign: 0,
            }"
          />
          <div class="overall-status-text">
            <div v-if="success" class="completed" :style="{ color: $coreTextAnnotation }">
              {{ $tr('completed') }}
            </div>
            <div>
              {{ $tr('goal', {count: totalCorrectRequiredM}) }}
            </div>
          </div>
        </div>
        <div class="table">
          <div class="row">
            <div class="left">
              <transition mode="out-in">
                <KButton
                  v-if="!complete"
                  appearance="raised-button"
                  class="question-btn"
                  :text="$tr('check')"
                  :primary="true"
                  :class="{shaking: shake}"
                  :disabled="checkingAnswer"
                  @click="checkAnswer"
                />
                <KButton
                  v-else
                  appearance="raised-button"
                  class="question-btn"
                  :text="$tr('next')"
                  :primary="true"
                  @click="nextQuestion"
                />
              </transition>
            </div>

            <div class="right">
              <ExerciseAttempts
                :waitingForAttempt="firstAttemptAtQuestion || itemError"
                :numSpaces="attemptsWindowN"
                :log="recentAttempts"
              />
              <p class="current-status">{{ currentStatus }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>


<script>

  import { mapState, mapGetters, mapActions } from 'vuex';
  import themeMixin from 'kolibri.coreVue.mixins.themeMixin';
  import { InteractionTypes, MasteryModelGenerators } from 'kolibri.coreVue.vuex.constants';
  import shuffled from 'kolibri.utils.shuffled';
  import { now } from 'kolibri.utils.serverClock';
  import ContentRenderer from 'kolibri.coreVue.components.ContentRenderer';
  import KButton from 'kolibri.coreVue.components.KButton';
  import UiAlert from 'kolibri.coreVue.components.UiAlert';
  import responsiveWindow from 'kolibri.coreVue.mixins.responsiveWindow';
  import { updateContentNodeProgress } from '../../modules/coreLearn/utils';
  import ExerciseAttempts from './ExerciseAttempts';

  export default {
    name: 'AssessmentWrapper',
    components: {
      ExerciseAttempts,
      ContentRenderer,
      KButton,
      UiAlert,
    },
    mixins: [responsiveWindow, themeMixin],
    $trs: {
      goal: 'Get {count, number, integer} {count, plural, other {correct}}',
      tryAgain: 'Try again',
      correct: 'Correct!',
      check: 'Check',
      next: 'Next',
      itemError: 'There was an error showing this item',
      completed: 'Completed',
      inputAnswer: 'Please enter an answer above',
      hintUsed: 'Hint used',
      greatKeepGoing: 'Great! Keep going',
      tryDifferentQuestion: 'Try a different question',
      tryNextQuestion: 'Try next question',
    },
    props: {
      id: {
        type: String,
        required: true,
      },
      lang: {
        type: Object,
      },
      kind: {
        type: String,
        required: true,
      },
      files: {
        type: Array,
        default: () => [],
      },
      contentId: {
        type: String,
        default: '',
      },
      channelId: {
        type: String,
        default: '',
      },
      available: {
        type: Boolean,
        default: false,
      },
      assessmentIds: {
        type: Array,
        required: true,
      },
      randomize: {
        type: Boolean,
        required: true,
      },
      masteryModel: {
        type: Object,
        required: true,
      },
      extraFields: {
        type: Object,
        default: () => {},
      },
      initSession: {
        type: Function,
        default: () => Promise.resolve(),
      },
    },
    data() {
      return {
        ready: false,
        itemId: '',
        shake: false,
        firstAttemptAtQuestion: true,
        complete: false,
        correct: 0,
        itemError: false,
        hintWasTaken: false,
        // Attempted fix for #1725
        checkingAnswer: false,
        checkWasAttempted: false,
      };
    },
    computed: {
      ...mapGetters(['isUserLoggedIn']),
      ...mapState('topicsTree', {
        topicsTreeContent: 'content',
      }),
      ...mapState({
        pageName: state => state.pageName,
        mastered: state => state.core.logging.mastery.complete,
        currentInteractions: state => state.core.logging.attempt.interaction_history.length,
        totalattempts: state => state.core.logging.mastery.totalattempts,
        pastattempts: state =>
          (state.core.logging.mastery.pastattempts || []).filter(attempt => attempt.error !== true),
        userid: state => state.core.session.user_id,
      }),
      recentAttempts() {
        if (!this.pastattempts) {
          return [];
        }
        return this.pastattempts
          .map((attempt, index) => {
            // if first item and not a current attempt
            if (index === 0 && !this.firstAttemptAtQuestion) {
              if (attempt.correct === 1) {
                // first attempt was correct
                return 'right';
              } else if (this.correct === 1 && this.complete === true) {
                // correct but not in first attempt
                return 'rectified';
              } else if (this.correct === 0 && this.hintWasTaken) {
                // not correct and hint
                return 'hint';
              } else {
                // not correct and no hint
                return 'wrong';
              }
            } else {
              return attempt.correct === 1 ? 'right' : 'rectified';
            }
          })
          .reverse();
      },
      mOfNMasteryModel() {
        return MasteryModelGenerators[this.masteryModel.type](
          this.assessmentIds,
          this.masteryModel
        );
      },
      totalCorrectRequiredM() {
        return this.mOfNMasteryModel.m;
      },
      attemptsWindowN() {
        return this.mOfNMasteryModel.n;
      },
      exerciseProgress() {
        if (this.mastered) {
          return 1;
        }
        if (this.pastattempts) {
          if (this.pastattempts.length > this.attemptsWindowN) {
            return Math.min(
              this.pastattempts.slice(0, this.attemptsWindowN).reduce((a, b) => a + b.correct, 0) /
                this.totalCorrectRequiredM,
              1
            );
          }
          return Math.min(
            this.pastattempts.reduce((a, b) => a + b.correct, 0) / this.totalCorrectRequiredM,
            1
          );
        }
        return 0;
      },
      success() {
        return this.exerciseProgress === 1;
      },
      currentStatus() {
        if (this.itemError) {
          return this.$tr('tryNextQuestion');
        } else if (this.firstAttemptAtQuestion && this.checkWasAttempted) {
          return this.$tr('inputAnswer');
        } else if (
          this.correct === 1 &&
          this.recentAttempts[this.recentAttempts.length - 1] === 'right'
        ) {
          return this.$tr('correct');
        } else if (this.correct === 1 && this.complete === true) {
          // rectified
          return this.$tr('greatKeepGoing');
        } else if (this.correct === 0 && this.hintWasTaken) {
          return this.$tr('hintUsed');
        } else if (this.checkWasAttempted) {
          return this.$tr('tryAgain');
        }
        return null;
      },
    },
    watch: { exerciseProgress: 'updateExerciseProgressMethod' },
    beforeDestroy() {
      if (this.currentInteractions > 0) {
        this.saveAttemptLogMasterLog(false);
      }
    },
    methods: {
      ...mapActions([
        'createAttemptLog',
        'createDummyMasteryLog',
        'initMasteryLog',
        'saveAndStoreAttemptLog',
        'saveAndStoreMasteryLog',
        'saveAttemptLog',
        'saveMasteryLog',
        'setMasteryLogComplete',
        'updateAttemptLogInteractionHistory',
        'updateExerciseProgress',
        'updateMasteryAttemptState',
      ]),
      updateAttemptLogMasteryLog({
        correct,
        complete,
        firstAttempt = false,
        hinted,
        answerState,
        simpleAnswer,
        error,
      }) {
        this.updateMasteryAttemptState({
          currentTime: now(),
          correct,
          complete,
          firstAttempt,
          hinted,
          answerState,
          simpleAnswer,
          error,
        });
      },
      saveAttemptLogMasterLog(updateStore = true) {
        if (updateStore) {
          this.saveAndStoreAttemptLog().then(() => {
            if (this.isUserLoggedIn && this.success) {
              this.setMasteryLogComplete(now());
              this.saveAndStoreMasteryLog();
            }
          });
        } else {
          this.saveAttemptLog().then(() => {
            if (this.isUserLoggedIn && this.success) {
              this.saveMasteryLog();
            }
          });
        }
      },
      checkAnswer() {
        this.checkWasAttempted = true;
        if (!this.checkingAnswer) {
          this.checkingAnswer = true;
          const answer = this.$refs.contentRenderer.checkAnswer();
          if (answer) {
            this.answerGiven(answer);
          }
          this.checkingAnswer = false;
        }
      },
      answerGiven({ correct, answerState, simpleAnswer }) {
        this.hintWasTaken = false;
        correct = Number(correct);
        this.correct = correct;
        if (correct < 1) {
          if (!this.shake) {
            setTimeout(() => {
              this.shake = false;
            }, 1000);
            this.shake = true;
          }
        }
        this.updateAttemptLogInteractionHistory({
          type: InteractionTypes.answer,
          answer: answerState,
          correct,
        });
        this.complete = correct === 1;
        if (this.firstAttemptAtQuestion) {
          this.firstAttemptAtQuestion = false;
          this.updateAttemptLogMasteryLog({
            correct,
            complete: this.complete,
            answerState,
            simpleAnswer,
            firstAttempt: true,
          });
          // Save attempt log on first attempt
          this.saveAttemptLogMasterLog();
        } else {
          this.updateAttemptLogMasteryLog({
            complete: this.complete,
          });
          if (this.complete) {
            // Otherwise only save if the attempt is now complete
            this.saveAttemptLogMasterLog();
          } else if (this.currentInteractions % 4 === 0) {
            // After every 4 interactions in this exercise, update the attemptlog
            // so needsHelp notification can be triggered
            this.saveAttemptLogMasterLog();
          }
        }
      },
      hintTaken({ answerState }) {
        this.updateAttemptLogInteractionHistory({
          type: InteractionTypes.hint,
          answer: answerState,
        });
        if (this.firstAttemptAtQuestion) {
          this.updateAttemptLogMasteryLog({
            correct: 0,
            complete: false,
            firstAttempt: true,
            hinted: true,
            answerState,
            simpleAnswer: '',
          });
          this.firstAttemptAtQuestion = false;
          // Only save if this was the first attempt to capture this
          this.saveAttemptLogMasterLog();
        }
        this.hintWasTaken = true;
      },
      setItemId() {
        const index = this.totalattempts % this.assessmentIds.length;
        if (this.randomize) {
          const seed = this.userid ? this.userid : Date.now();
          this.itemId = shuffled(this.assessmentIds, seed)[index];
        } else {
          this.itemId = this.assessmentIds[index];
        }
      },
      nextQuestion() {
        this.complete = false;
        this.shake = false;
        this.firstAttemptAtQuestion = true;
        this.correct = 0;
        this.itemError = false;
        this.setItemId();
        this.callCreateAttemptLog();
        this.checkWasAttempted = false;
      },
      callInitMasteryLog() {
        this.initMasteryLog({
          masterySpacingTime: this.masterySpacingTime,
          masteryCriterion: this.masteryModel,
        });
      },
      callCreateAttemptLog() {
        this.ready = false;
        this.createAttemptLog(this.itemId);
        this.ready = true;
      },
      updateExerciseProgressMethod() {
        this.updateExerciseProgress({ progressPercent: this.exerciseProgress });
        updateContentNodeProgress(this.channelId, this.id, this.exerciseProgress);
        this.$emit('updateProgress', this.exerciseProgress);
      },
      sessionInitialized() {
        if (this.isUserLoggedIn) {
          this.callInitMasteryLog();
        } else {
          this.createDummyMasteryLog();
        }
        this.nextQuestion();
        this.$emit('sessionInitialized');
      },
      handleItemError() {
        this.itemError = true;
        this.updateAttemptLogInteractionHistory({
          type: InteractionTypes.error,
        });
        this.complete = true;
        if (this.firstAttemptAtQuestion) {
          this.updateAttemptLogMasteryLog({
            correct: 0,
            complete: this.complete,
            firstAttempt: true,
            error: true,
          });
          this.firstAttemptAtQuestion = false;
        } else {
          this.updateAttemptLogMasteryLog({ complete: this.complete });
        }
        this.saveAttemptLogMasterLog();
      },
      updateProgress(...args) {
        this.$emit('updateProgress', ...args);
      },
      updateContentState(...args) {
        this.$emit('updateContentState', ...args);
      },
      startTracking(...args) {
        this.$emit('startTracking', ...args);
      },
      stopTracking(...args) {
        this.$emit('stopTracking', ...args);
      },
    },
  };

</script>


<style lang="scss" scoped>

  @import '~kolibri.styles.definitions';

  // BOTTOM_SPACED_RESERVED depends on the height of this container
  .attempts-container {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 8; // material - Bottom app bar
    padding: 8px 16px;
    margin: 0;
    overflow-x: hidden;
    font-size: 14px;
    box-shadow: 0 8px 10px -5px rgba(0, 0, 0, 0.2), 0 16px 24px 2px rgba(0, 0, 0, 0.14),
      0 6px 30px 5px rgba(0, 0, 0, 0.12);
  }

  .margin-wrapper {
    max-width: 936px; // account for page padding 1000 - 64
    margin: auto;
  }

  .mobile {
    padding: 8px;
  }

  .overall-status {
    margin-bottom: 8px;
  }

  .overall-status-text {
    display: inline-block;
    margin-left: 4px;
  }

  .completed {
    font-size: 12px;
  }

  .table {
    display: table;
  }

  .row {
    display: table-row;
  }

  .left,
  .right {
    display: table-cell;
    vertical-align: top;
  }

  .right {
    width: 99%;
    padding-left: 8px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .question-btn {
    margin: 0;
  }

  // checkAnswer btn animation
  .shaking {
    @extend %enable-gpu-acceleration;

    animation: shake 0.8s ease-in-out both;
  }

  @keyframes shake {
    10%,
    90% {
      transform: translate3d(-1px, 0, 0);
    }
    20%,
    80% {
      transform: translate3d(2px, 0, 0);
    }
    30%,
    50%,
    70% {
      transform: translate3d(-4px, 0, 0);
    }
    40%,
    60% {
      transform: translate3d(4px, 0, 0);
    }
  }

  .current-status {
    height: 18px;
    margin: 0;
  }

</style>
