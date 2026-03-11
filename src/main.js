const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const axios = require('axios')

class ScreenCloudInstance extends InstanceBase {
    constructor(internal) {
        super(internal)
        this.screens = []
        this.contents = []
        this.states = {} 
        this.customLabels = {} 
    }

    async init(config) {
        this.config = config
        
        // 1. Sichere Registrierung der Actions & Feedbacks beim Start
        this.initActions()
        this.initFeedbacks()

        // 2. Start-Routine
        if (this.config.apiKey) {
            this.updateStatus(InstanceStatus.Connecting)
            this.reloadData() // reloadData setzt den Status am Ende auf Ok

            if (this.refreshInterval) clearInterval(this.refreshInterval)
            this.refreshInterval = setInterval(() => this.reloadData(), 30000)
        } else {
            this.updateStatus(InstanceStatus.BadConfig, 'API-Key is missing')
        }
    }

    async destroy() {
        if (this.refreshInterval) clearInterval(this.refreshInterval)
    }

    async configUpdated(config) {
        this.config = config
        this.log('debug', 'configuration updated, reload data')
        this.updateStatus(InstanceStatus.Connecting)
        
        try {
            await this.reloadData()
            // Status wird durch reloadData auf Ok gesetzt
        } catch (error) {
            this.log('error', 'error while reloading: ' + error.message)
            this.updateStatus(InstanceStatus.ConnectionFailure, error.message)
        }
    }

    getConfigFields() {
        return [{ type: 'textinput', id: 'apiKey', label: 'API Key', width: 12 }]
    }

    async reloadData() {
        if (!this.config.apiKey) return
        try {
            const res = await axios({
                method: 'post',
                url: 'https://graphql.eu.screencloud.com/graphql',
                headers: { 'Authorization': `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    query: `query { 
                        allScreens(first: 50) { nodes { id name content } } 
                        allChannels(first: 100) { nodes { id name } } 
                    }`
                }),
                timeout: 7000
            })

            const d = res.data?.data
            if (d) {
                const channelMap = {}
                const uniqueChannelNames = new Set() 
                const filteredChannels = []

                if (d.allChannels?.nodes) {
                    d.allChannels.nodes.forEach(c => {
                        if (!c.name) return
                        const nameTrimmed = c.name.trim()
                        const nameLower = nameTrimmed.toLowerCase()

                        if (!uniqueChannelNames.has(nameLower) && 
                            !nameLower.includes('blank') && 
                            !nameLower.includes('brand')) {
                            
                            uniqueChannelNames.add(nameLower)
                            filteredChannels.push({ id: c.id, label: nameTrimmed })
                            channelMap[c.id] = nameTrimmed
                        } else if (uniqueChannelNames.has(nameLower)) {
                            channelMap[c.id] = nameTrimmed
                        }
                    })
                }
                this.contents = filteredChannels

                const variables = []
                const variableValues = {}

                this.screens = (d.allScreens?.nodes || []).map(s => {
                    const rawContent = s.content || s.Content
                    if (rawContent) {
                        try {
                            const parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent
                            if (parsed?._ref?.id && (!this.lastActionTime || Date.now() - this.lastActionTime > 5000)) {
                                this.states[s.id] = parsed._ref.id
                            }
                        } catch (e) {}
                    }
                    
                    const currentChannelName = channelMap[this.states[s.id]] || '...'
                    const varId = `status_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
                    variables.push({ variableId: varId, name: `Status: ${s.name}` })
                    variableValues[varId] = `${s.name}: ${currentChannelName}`
                    return { id: s.id, label: s.name }
                })

                for (const [varName, cfg] of Object.entries(this.customLabels)) {
                    const sName = this.screens.find(s => s.id === cfg.screenId)?.label || '...'
                    const cName = this.contents.find(c => c.id === cfg.contentId)?.label || channelMap[cfg.contentId] || '...'
                    variableValues[varName] = `${sName}:\n${cName}`
                    variables.push({ variableId: varName, name: `Button: ${varName}` })
                }

                this.setVariableDefinitions(variables)
                this.setVariableValues(variableValues)
                
                this.initActions()
                this.initFeedbacks()
                this.checkFeedbacks()
                
                this.updateStatus(InstanceStatus.Ok)
            }
        } catch (e) {
            this.log('error', `update error: ${e.message}`)
            this.updateStatus(InstanceStatus.ConnectionFailure, e.message)
        }
    }

    initActions() {
        const screenChoices = this.screens.length > 0 ? this.screens : [{ id: 'none', label: 'loading screens...' }]
        const contentChoices = this.contents.length > 0 ? this.contents : [{ id: 'none', label: 'loading content...' }]

        this.setActionDefinitions({
            set_screen_content: {
                name: 'change screens/channels',
                options: [
                    { type: 'dropdown', label: 'Screen', id: 'screenId', default: screenChoices[0].id, choices: screenChoices },
                    { type: 'dropdown', label: 'Content', id: 'contentId', default: contentChoices[0].id, choices: contentChoices }
                ],
                callback: async (event) => {
                    if (event.options.screenId === 'none' || event.options.contentId === 'none') {
                        this.log('warn', 'Please select a valid screen and content.')
                        return
                    }
                    try {
                        const response = await axios({
                            method: 'post',
                            url: 'https://graphql.eu.screencloud.com/graphql',
                            headers: { 'Authorization': `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
                            data: JSON.stringify({
                                query: `mutation($i: SetScreenContentInput!) { setScreenContent(input: $i) { clientMutationId } }`,
                                variables: { i: { screenId: event.options.screenId, contentId: event.options.contentId, contentType: 'CHANNEL' } }
                            })
                        })

                        if (response.status === 200) {
                            this.lastActionTime = Date.now()
                            this.states[event.options.screenId] = event.options.contentId
                            this.reloadData() 
                        }
                    } catch (err) { this.log('error', `switching error: ${err.message}`) }
                }
            }
        })
    }

    initFeedbacks() {
        const screenChoices = this.screens.length > 0 ? this.screens : [{ id: 'none', label: 'loading screens...' }]
        const contentChoices = this.contents.length > 0 ? this.contents : [{ id: 'none', label: 'loading content...' }]

        this.setFeedbackDefinitions({
            content_active: {
                type: 'boolean',
                name: 'color active',
                defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
                options: [
                    { type: 'dropdown', label: 'Screen', id: 'screenId', default: screenChoices[0].id, choices: screenChoices },
                    { type: 'dropdown', label: 'Content', id: 'contentId', default: contentChoices[0].id, choices: contentChoices },
                    { type: 'textinput', label: 'variable name (e.g. ch1)', id: 'varName', default: '' }
                ],
                callback: (fb) => {
                    if (fb.options.varName) {
                        const vName = fb.options.varName.trim().toLowerCase().replace(/[^a-z0-9]/gi, '_')
                        if (vName.length > 1 && (!this.customLabels[vName] || this.customLabels[vName].contentId !== fb.options.contentId)) {
                            this.customLabels[vName] = { screenId: fb.options.screenId, contentId: fb.options.contentId }
                        }
                    }
                    return this.states[fb.options.screenId] === fb.options.contentId
                }
            }
        })
    }
}
runEntrypoint(ScreenCloudInstance, [])