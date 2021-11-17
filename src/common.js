export default {
    initAnnotator(params) {
        console.log('Loading interface: params:', params)
        this.information = params
        this.labels = JSON.parse(this.information['project']['label']).concat(['Previous', 'Next'])
        this.idx = this.information['task']['current']
        this.total = this.information['task']['size']
        this.task_id = this.information['task']['id']
        this.initKeyboardEvents()
        this.getData(this.idx)
    },
    destroyAnnotator() {
        Object.keys(this.$eventBus.getEvents())
            .filter(e => e.endsWith('[Annotation]'))
            .forEach(eventName => {
                    for (let eventFunc of this.$eventBus.getEvents()[eventName].values())
                        this.$eventBus.off(eventName, eventFunc)
                }
            )
    },
    initKeyboardEvents() {
        let project_key = `Project:${this.information.project.id}`
        if (localStorage.getItem(project_key) === null) {
            // Initialize project config
            let config = {hotkey: {}} // {label: key}
            this.shortcuts = []
            localStorage.setItem(project_key, JSON.stringify(config))
        } else {
            let config = JSON.parse(localStorage.getItem(project_key))
            let hotkey = config['hotkey']
            for (let label of this.labels) {
                if (hotkey[label] !== undefined && hotkey[label] !== null && hotkey[label] !== '') {
                    this.shortcuts.push(hotkey[label].toUpperCase())
                    this.$eventBus.on(`PressKey[${hotkey[label]}][Annotation]`, () => this.handleLabel(label))
                    console.log(this.$eventBus.getEvents())
                } else {
                    this.shortcuts.push('')
                }
            }
        }
    },
    changeHotkey(hotkeys) {
        this.show_config = false
        this.shortcuts = hotkeys
        // Delete previous key event
        Object.keys(this.$eventBus.getEvents())
            .filter(e => e.startsWith('PressKey'))
            .forEach(eventName => {
                    for (let eventFunc of this.$eventBus.getEvents()[eventName].values())
                        this.$eventBus.off(eventName, eventFunc)
                }
            )
        let hotkey_config = {}
        for (let i = 0; i < this.labels.length; i++) {
            let label = this.labels[i]
            hotkey_config[label] = this.shortcuts[i].toLowerCase()
            console.log(`Register ${hotkey_config[label]} for ${label}`)
            if (hotkey_config[label] !== undefined && hotkey_config[label] !== null && hotkey_config[label] !== '')
                this.$eventBus.on(`PressKey[${hotkey_config[label]}][Annotation]`, () => this.handleLabel(label))
        }
        let project_key = `Project:${this.information.project.id}`
        let config = JSON.parse(localStorage.getItem(project_key))
        config['hotkey'] = hotkey_config
        localStorage.setItem(project_key, JSON.stringify(config))
    },
    getData(idx) {
        this.$eventBus.emit('getData[Annotation]', [this.task_id, idx])
    },
    openDocument() {
        this.$eventBus.emit('openDocument[Annotation]', this.information.project.document)
    }
}

export function throttle(fn, delay) {
    let last = 0
    return function () {
        let context = this
        let args = arguments
        let now = +new Date()

        if (now - last >= delay) {
            last = now
            fn.apply(context, args)
        }
    }
}