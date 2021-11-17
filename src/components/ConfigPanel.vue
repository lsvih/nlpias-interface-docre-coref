<template>
    <div class='config-container'>
        <a-modal :visible="visible" title="Hotkey Config" :mask-closable="false" @ok="save" @cancel="cancel"
                 okText="Save">
            <table class="config-content">
                <tr v-for="(label, index) in labels" v-bind:key="index">
                    <td>{{ label }}</td>
                    <td>
                        <a-icon type="arrow-right"/>
                    </td>
                    <td>
                        <input type="text" maxlength="1" class="hotkey" v-model="custom_shortcuts[index]"
                               @focus='focus($event)'/>
                    </td>
                </tr>
            </table>
        </a-modal>
    </div>
</template>

<script>
export default {
    name: 'ConfigPanel',
    data() {
        return {
            custom_shortcuts: []
        }
    },
    created() {
        this.custom_shortcuts = this.shortcuts
    },
    props: ['visible', 'labels', 'shortcuts'],
    methods: {
        focus(e) {
            e.currentTarget.select()
        },
        cancel() {
            this.$emit('close')
        },
        save() {
            this.custom_shortcuts = this.custom_shortcuts.map(e => e.toUpperCase())
            if (this.custom_shortcuts.filter(e => e !== '').length !== (new Set(this.custom_shortcuts.filter(e => e !== ''))).size)
                this.$message.error('Duplicated hotkey, please recheck.')
            else
                this.$emit('save', this.custom_shortcuts)
        }
    }
}
</script>

<style scoped>
.config-content {
    font-size: 22px;
    width: 100%;
}

.hotkey {
    cursor: pointer;
    background-color: #dddddd;
    text-align: center;
    border: none;
    width: 50px;
}

</style>