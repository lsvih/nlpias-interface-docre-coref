import Entry from './views/Entry'

export default function (Vue) {
    console.log('Interface Module Loaded, $vm instance: ', Vue)
    this.interface = Entry
    // (new Vue.extend(Home)).$mount('#interface')
}
