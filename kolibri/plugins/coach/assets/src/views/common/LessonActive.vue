<template>

  <span>
    <KLabeledIcon :style="active ? null : { color: $coreGrey300 }">
      <KIcon slot="icon" dot :color="active ? $coreStatusCorrect : $coreGrey300" />
      {{ label }}
    </KLabeledIcon>
  </span>

</template>


<script>

  import KLabeledIcon from 'kolibri.coreVue.components.KLabeledIcon';
  import KIcon from 'kolibri.coreVue.components.KIcon';
  import themeMixin from 'kolibri.coreVue.mixins.themeMixin';

  export default {
    name: 'LessonActive',
    components: {
      KLabeledIcon,
      KIcon,
    },
    mixins: [themeMixin],
    props: {
      active: {
        type: Boolean,
        required: true,
      },
    },
    $trs: {
      active: 'Active',
      inactive: 'Inactive',
    },
    computed: {
      label() {
        return this.active ? this.$tr('active') : this.$tr('inactive');
      },
    },
  };

</script>


<style lang="scss" scoped></style>
