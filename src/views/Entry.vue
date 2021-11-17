<template>
    <div class="interface-panel">
        <div class="text-panel">
            <div class="text" ref="content"/>
        </div>
        <div class="label-panel">
            <button @click="handleLabel(label)" class="label" v-for="(label, index) in labels"
                    :style="{backgroundColor: colors[index]}"
                    v-bind:key="index">
                {{ label }}
                <span v-if="index === labels.indexOf(predict)" class="auto"></span>
                <span class="shortcut" v-if="shortcuts[index] !== ''">{{ shortcuts[index] }}</span>
            </button>
            <button class="label" @click="deleteLabel">
                Delete<span class="shortcut"><backspace-icon style="width:21px;height: 21px;"/></span>
            </button>
        </div>
        <div class="config-btn">
            <document-icon v-if="!!information.project && (!!information.project.document)"
                           @click.native="openDocument"/>
            <setting-icon @click.native="show_config = true"/>
        </div>
        <div class="indicator">{{ idx + 1 }} / {{ total }}</div>
        <a-progress :percent="idx / total * 100" :show-info="false" class="progress" :stroke-width="14"
                    stroke-color="blue" stroke-linecap="square"/>
        <config-panel :visible="show_config" :labels="labels" :shortcuts="shortcuts" @close="show_config = false"
                      @save="changeHotkey"/>
    </div>
</template>

<script>

import {schemeSet2, schemeSet3} from 'd3-scale-chromatic'
import DocumentIcon from '../components/icons/document'
import SettingIcon from '../components/icons/setting'
import BackspaceIcon from '../components/icons/backspace'
import ConfigPanel from '../components/ConfigPanel'
import commonMethods from '../common'
import {throttle} from '@/common'

/*
Events who end with [Annotation] is the event for annotaion panel, would be destroy while closing the annotation interface.

schema
emit:
getData(task_id, idx) 向 Main 索取 task_id 任务的第 idx 条数据
labelData(task_id, idx, label) 通知 Main 标注成功 task_id 任务的第 idx 条数据，结果为 label

on:
sentData(text, ?predict) 推送回 getData 请求的数据与预测

 */

export default {
    name: 'Entry',
    components: {DocumentIcon, SettingIcon, BackspaceIcon, ConfigPanel},
    data() {
        return {
            title: 'Interface',
            information: {},
            total: null,
            task_id: null,
            idx: 0,
            colors: [...schemeSet2, ...schemeSet3],
            shortcuts: [],
            labels: [],
            spans: [],
            predict: [],
            text: '',
            show_config: false
        }
    },
    watch: {
        sample(n) {
            this.$refs['content'].innerHTML = n
        }
    },
    computed: {
        reversed_span_label() {
            let reversed_span_label = {}
            for (let span of this.spans) {
                reversed_span_label[span.span.toString()] = span.type
            }
            return reversed_span_label
        },
        pure_spans() {
            let pure_spans = []
            for (let span of this.spans) {
                pure_spans.push(span.span)
            }
            pure_spans.sort()
            return pure_spans
        },
        sample() {
            let data = ''
            let axis = 0
            let idx = 0
            for (let span of this.pure_spans) {
                data += `<span data-id="${idx}">${this.text.slice(axis, span[0])}</span>`
                let color = this.colors[this.labels.indexOf(this.reversed_span_label[span.toString()])]
                data += `<button class="tagged" data-data="${span.toString()}" data-id="${idx + 1}" style="background-color: ${color}">${this.text.slice(...span)}</button>`
                axis = span[1]
                idx += 2
            }
            data += `<span data-id="${idx}">${this.text.slice(axis)}</span>`
            return data
        }
    },
    created() {
        console.log('Remote Interface Created.')
        this.registerEvents()
    },
    methods: {
        ...commonMethods,
        registerEvents() {
            this.$eventBus.on('Destroy[Annotation]', () => {
                this.destroyAnnotator()
            })
            this.$eventBus.on('PressKey[Delete][Annotation]', () => {
                this.deleteLabel()
            })
            this.$eventBus.on('Mount[Annotation]', params => {
                this.initAnnotator(params)
            })
            this.$eventBus.on('sentData[Annotation]', data => {
                let text, label, predict
                [text, label, predict] = data
                this.text = text.replace(/\\n/g, '<br />')
                this.predict = predict || []
                this.spans = label || []
            })
        },
        nextData: throttle(function () {
            this.$eventBus.emit('labelData[Annotation]', [this.task_id, this.idx, this.spans])
            if (this.idx === this.information.task.size - 1) {
                this.$message.info('It\'s already the last data.')
                return
            }
            this.idx += 1
            this.getData(this.idx)
        }, 1000),
        handleLabel(label) {
            if (label === 'Previous') { // get previous data
                if (this.idx === 0) { // prevent event while on first data
                    this.$message.info('It\'s already the first data.')
                    return
                }
                this.idx -= 1
                this.getData(this.idx)
            } else if (label === 'Next') {
                this.nextData()
            } else {
                let selector = window.getSelection().getRangeAt(0)
                let selector_base_pos = 0
                let selector_node_id = window.getSelection().anchorNode.parentElement.dataset.id
                for (let i = 0; i < selector_node_id; i++)
                    selector_base_pos += document.querySelector(`[data-id="${i}"]`).innerText.length
                let start = selector_base_pos + Math.min(selector.startOffset, selector.endOffset)
                let end = selector_base_pos + Math.max(selector.startOffset, selector.endOffset)
                console.log(this.text.slice(start, end))
                if (end > this.text.length || end - start <= 0) {
                    return
                }
                for (let span of this.spans) { // Detect nested
                    console.log(span.span[0], span.span[1], start, end)
                    if (((span.span[1] > start) && (start >= span.span[0])) ||
                        ((span.span[0] < end) && (end <= span.span[1]))) {
                        this.$message.info('Nesting is not supported')
                        return
                    }
                }
                console.log([start, end])
                this.spans.push({type: label, span: [start, end]})
                this.$eventBus.emit('labelData[Annotation]', [this.task_id, this.idx, this.spans])
            }
        },
        deleteLabel() {
            let active_elem = document.activeElement
            if (active_elem.nodeName !== 'BUTTON' || active_elem.dataset.data === undefined) {
                this.$message.info('The element that needs to be removed must be selected')
                return
            } else {
                this.spans = this.spans.filter(e => e.span.toString() !== active_elem.dataset.data)
            }
        }
    }
}
</script>

<style scoped>
.interface-panel {
    width: 100%;
    height: 100%;
    z-index: 2;
    background-color: #fff;
    position: relative;
}

.text-panel {
    border-radius: 20px;
    border: 1px solid #ccc;
    padding: 20px;
    width: 80vw;
    max-height: 60vh;
    overflow-y: auto;
    margin: 10vh 10vw;
    font-size: 22px;
}

.label-panel {
    position: fixed;
    bottom: 5vh;
    margin: 0 10vw;
}

.label {
    position: relative;
    background-color: #ddd;
    height: 60px;
    font-size: 25px;
    padding: 0 25px;
    border-radius: 10px;
    border: none;
    margin-right: 70px;
    cursor: pointer;
}

.label:hover {
    filter: brightness(70%);
}

.shortcut {
    display: inline-block;
    height: 25px;
    width: 25px;
    line-height: 25px;
    vertical-align: middle;
    font-size: 15px;
    color: #000;
    font-weight: bold;
    padding: 0;
    border: 2px solid #000;
    border-radius: 5px;
    opacity: 0.2;
}

.config-btn {
    position: fixed;
    right: 20px;
    bottom: 5vh;
    padding-bottom: 10px;
}

.auto {
    display: inline-block;
    position: absolute;
    height: 10px;
    width: 10px;
    background-color: yellow;
    border-radius: 5px;
    left: 5px;
    top: 5px;
}

.progress {
    position: fixed;
    bottom: 0;
    left: 0;
}

.indicator {
    position: fixed;
    top: 60px;
    right: 10px;
    z-index: 10;
    user-select: none;
    color: #ddd;
    font-size: 30px;
    transition-duration: .5s;
}

.indicator:hover {
    color: #000
}
</style>

<style>
.interface-container .progress .ant-progress-inner {
    border-radius: 0 !important;
    vertical-align: bottom !important;
}

.interface-container button.tagged {
    border: none;
}
</style>