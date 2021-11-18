<template>
    <div class="interface-panel">
        <div class="text-panel">
            <div class="text" @mouseup="onSelectText">
                <div class="title">{{ text['title'] }}</div>
                <div class="sent" v-for="(sent, sent_idx) in text['sents']" :key="sent_idx" style="text-indent: 2em;">
                    <span v-for="(token, pos) in sent" :key="sent_idx + pos" :data-sent-id="sent_idx" :data-pos="pos"
                          :class="['token',
                          entity_class(sent_idx, pos)['type'],
                          highlight_vertex.includes(entity_class(sent_idx, pos)['vertex']) ? 'hover' : '']">
                        {{
                            token
                        }} <span v-if="is_frist_token_in_one_span(sent_idx, pos)"
                                 :data-vertex-id="entity_class(sent_idx, pos)['vertex']"
                                 @mouseenter="hoverSup(sent_idx, pos, $event)"
                                 @mouseleave="highlight_vertex = []"
                                 @click="handleClickSup(sent_idx, pos, $event)"
                                 :class="['sup',
                                            entity_class(sent_idx, pos)['type'],
                                            entity_class(sent_idx, pos)['vertex'] === selected_vertex ? 'selected_vertex' : '',
                                            entity_class(sent_idx, pos)['vertex'] === selected_vertex && get_sup_idx(entity_class(sent_idx, pos)['vertex'], sent_idx, pos) === selected_sup ? 'selected_sup' : '' ]">{{
                            entity_class(sent_idx, pos)['type']
                        }}
                    </span>
                    </span>
                </div>
            </div>
        </div>
        <div class="merge-panel">
            <div v-for="(merge, merge_idx) in merged_vertex"
                 :key="merge_idx"
                 class="merge-item"
                 @mouseenter="highlight_vertex = merge"
                 @mouseleave="highlight_vertex = []"
            ><span v-for="(item, item_idx) in merge" :key="`${merge_idx},${item_idx}`"
                   style="margin: 0 2px;">{{ item_idx !== 0 ? '⇄' : '' }}V{{ item }}</span>
                <span><del-icon @click.native="removeMergeVertex(merge_idx)"/></span>
            </div>
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
            <alarm-icon @click.native="reportId"/>
            <document-icon v-if="!!information.project && (!!information.project.document)"
                           @click.native="openDocument"/>
            <setting-icon @click.native="show_config = true"/>
        </div>
        <div class="indicator">{{ idx + 1 }} / {{ total }}</div>
        <a-progress :percent="( idx + 1 ) / total * 100" :show-info="false" class="progress" :stroke-width="14"
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
import AlarmIcon from '../components/icons/alarm'
import DelIcon from '../components/icons/del'
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
    components: {DocumentIcon, SettingIcon, BackspaceIcon, AlarmIcon, DelIcon, ConfigPanel},
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
            span: [],
            merged_vertex: [],
            highlight_vertex: [],
            selected_vertex: -1,
            selected_sup: -1,
            predict: [],
            text: {},
            show_config: false,
        }
    },
    created() {
        console.log('Remote Interface Created.')
        this.registerEvents()
        this.initStyle()
    },
    methods: {
        is_frist_token_in_one_span(sent_id, pos) {
            for (let v of this.text['vertexSet'].flat().filter(e => e['sent_id'] === sent_id)) {
                if (pos === v['pos'][0])
                    return true
            }
            return false
        },
        entity_class(sent_id, pos) {
            for (let [vertex_index, vertex] of this.text['vertexSet'].entries()) {
                for (let e of vertex) {
                    if (e['sent_id'] === sent_id) {
                        if (e['pos'][0] <= pos && pos < e['pos'][1])
                            return {type: e['type'], vertex: vertex_index}
                    }
                }
            }
            return {type: '', vertex: null}
        },
        get_sup_idx(vertex_id, sent_id, pos) {
            for (let [entity_idx, entity] of this.text.vertexSet[vertex_id].entries()) {
                if (entity.sent_id === sent_id && entity.pos[0] <= pos && pos < entity.pos[1])
                    return entity_idx
            }
            return -1
        },
        hoverSup(sent_id, pos, event) {
            // 鼠标移入了第 sent_id 句话中的以 pos 为起始位置的 span
            let vertex = Number(event.target.dataset.vertexId)
            this.highlight_vertex = []
            for (let merge_item of this.merged_vertex) {
                if (merge_item.includes(vertex)) {
                    this.highlight_vertex = merge_item
                    return
                }
            }
            if (this.highlight_vertex.length === 0)
                this.highlight_vertex = [vertex]
        },
        handleClickSup(sent_id, pos, event) {
            let entity_type = event.target.textContent
            let vertex = Number(event.target.dataset.vertexId)
            if (this.selected_vertex === -1) {
                if (window.getSelection().type !== 'Range') {
                    this.selected_vertex = vertex
                    this.selected_sup = this.get_sup_idx(vertex, sent_id, pos)
                } else {
                    let selector = window.getSelection().getRangeAt(0)
                    if (!(selector.startContainer.parentElement.classList.contains('token') &&
                        selector.endContainer.parentElement.classList.contains('token')
                    )) {
                        this.$message.info('请在文章中正确框选')
                        window.getSelection().removeAllRanges()
                        return
                    }
                    let start = selector.startContainer.parentElement.dataset
                    let end = selector.endContainer.parentElement.dataset
                    if (start.sentId !== end.sentId) {
                        this.$message.info('选取起始与结束必须是同一个句子！')
                        window.getSelection().removeAllRanges()
                        return
                    }
                    let start_pos = Number(start.pos)
                    let end_pos = Number(end.pos) + 1
                    let selete_sent_id = Number(start.sentId)
                    // 验证是否选择的存在 overlap
                    for (let entity of this.text.vertexSet.flat().filter(e => e.sent_id === selete_sent_id)) {
                        if ((start_pos > entity.pos[0] && start_pos < entity.pos[1]) ||
                            (end_pos > entity.pos[0] && end_pos < entity.pos[1])) {
                            console.log(this.text.sents[selete_sent_id].slice(start_pos, end_pos).join(' '))
                            console.log(entity, sent_id)
                            this.$message.info('请不要嵌套标注！')
                            return
                        }
                    }
                    this.text.vertexSet[vertex].push({
                        pos: [start_pos, end_pos],
                        type: entity_type,
                        sent_id: selete_sent_id,
                        name: this.text.sents[start.sentId].slice(start_pos, end_pos).join(' '),
                    })
                    window.getSelection().removeAllRanges()
                    return true
                }
            } else {
                if (this.selected_vertex === vertex) {
                    // 选中一样的节点时，取消选中
                    if (this.selected_sup !== this.get_sup_idx(vertex, sent_id, pos)) {
                        this.selected_sup = this.get_sup_idx(vertex, sent_id, pos)
                    } else {
                        this.selected_vertex = -1
                        this.selected_sup = -1
                    }
                } else {
                    // 将选中的vertex加入merge vertex列表中，如果列表中已经有了这个 vertex 则附在后面
                    let flag = 0
                    for (let merge_item of this.merged_vertex) {
                        if (merge_item.includes(this.selected_vertex)) {
                            if (merge_item.includes(vertex)) {
                                break
                            } else {
                                merge_item.push(vertex)
                                flag = 1
                                break
                            }
                        } else if (merge_item.includes(vertex)) {
                            merge_item.push(this.selected_vertex)
                            flag = 1
                            break
                        }
                    }
                    if (flag === 0)
                        this.merged_vertex.push([this.selected_vertex, vertex])
                    this.selected_vertex = -1
                    this.selected_sup = -1
                }
            }
        },
        initStyle() {
            let sheet = new CSSStyleSheet()
            const entity_type = ['BLANK', 'ORG', 'LOC', 'TIME', 'PRE', 'NUM', 'MISC']
            for (let i = 0; i < entity_type.length; i++) {
                sheet.insertRule(`.${entity_type[i]}{ background-color: ${this.colors[i + 4]}}`, i)
                sheet.insertRule(`.${entity_type[i]} .sup:hover{ filter: brightness(110%); z-index: 10;`, i)
            }
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
        },
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
                this.text = JSON.parse(text)
                this.predict = predict || []
                this.span = label || []
            })
        },
        nextData: throttle(function () {
            this.$eventBus.emit('labelData[Annotation]', [this.task_id, this.idx, this.span])
            if (this.idx === this.information.task.size - 1) {
                this.$message.info('It\'s already the last data.')
                return
            }
            this.idx += 1
            this.getData(this.idx)
            window.getSelection().empty()
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
                let start = Number(selector.startContainer.parentElement.dataset.pos)
                let end = Number(selector.endContainer.parentElement.dataset.pos)
                console.log([start, end])
                this.span = [start, end]
                this.$eventBus.emit('labelData[Annotation]', [this.task_id, this.idx, this.span])
                window.getSelection().empty()
            }
        },
        deleteLabel() {
            if (this.selected_vertex === -1 || this.selected_sup === -1)
                return
            this.$delete(this.text.vertexSet[this.selected_vertex], this.selected_sup)
            this.selected_sup = -1
            this.selected_vertex = -1
        },
        reportId() {
            let aux = document.createElement('input')
            aux.setAttribute('value', this.text['id'])
            document.body.appendChild(aux)
            aux.select()
            document.execCommand('copy')
            document.body.removeChild(aux)
            this.$message.info('The data id has been copied to clipboard, please contact administrator.')
        },
        onSelectText(e) {
            if (e.target.classList.contains('sup')) {
                // 如果是在标签上点击的，则把控制权给 handleClickSup
                if (window.getSelection().type === 'Range') {
                    this.selected_vertex = -1
                }
                return
            }
            this.selected_vertex = -1
        },
        removeMergeVertex(merge_id) {
            this.$delete(this.merged_vertex, merge_id)
            this.highlight_vertex = []
        },
    },
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
    max-height: 80vh;
    overflow-y: auto;
    margin: 7vh 6vw;
    font-size: 18px;
}

.token {
    position: relative;
    padding: 0 2px;
    box-sizing: border-box;
}

.hover {
    border-bottom: 5px solid blue;
}

.selected_sup {
    color: red;
    font-weight: bolder;
}

.selected_vertex {
    border-top: 4px solid red;
}

.sup {
    box-sizing: border-box;
    position: absolute;
    line-height: 24px;
    font-weight: bold;
    font-size: 13px;
    padding: 0 10px;
    border-radius: 5px 5px 0 0;
    user-select: none;
    top: -24px;
    left: 0;
    cursor: pointer;
}

.merge-panel {
    position: absolute;
    right: 5px;
    top: 10vh;
    text-align: right;
}

.merge-item {
    background: darkgreen;
    color: #fff;
    font-size: 18px;
    font-weight: bolder;
    padding: 2px 5px;
    margin-bottom: 5px;
}

.merge-item:hover {
    background: green;
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

.text {
    line-height: 60px;
    /*margin: 30px 0;*/
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

.title {
    text-align: center;
    font-weight: bold;
    user-select: none;
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
