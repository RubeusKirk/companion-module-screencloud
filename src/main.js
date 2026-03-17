const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const axios = require('axios')
const { getActions } = require('./actions')
const { getFeedbacks } = require('./feedbacks')
const variables = require('./variables')

class ScreenCloudInstance extends InstanceBase {
    constructor(internal) {
        super(internal)
        this.screens = []
        this.contents = []
        this.states = {}
        this.customLabels = {}
        this.initialScanDone = false
        this.isProcessingBlacklist = false
        this.scannedIds = new Set()
    }

    async init(config) {
        this.config = config

        this.isScanningActive = false;
        this.scanProgressValue = '0%';
        
        this.initActions()
        this.initFeedbacks()
        this.initVariables()

        if (this.config.apiKey) {
            this.updateStatus(InstanceStatus.Connecting)
            this.reloadData()

            if (this.refreshInterval) clearInterval(this.refreshInterval)
            // Alle 10 Sekunden Daten laden
            this.refreshInterval = setInterval(() => this.reloadData(), 10000)
        } else {
            this.updateStatus(InstanceStatus.BadConfig, 'API-key is missing')
        }
    }

    async destroy() {
        if (this.refreshInterval) clearInterval(this.refreshInterval)
    }

    async configUpdated(config) {
        this.config = config
        this.log('debug', 'Configuration updated, reloading...')
        this.updateStatus(InstanceStatus.Connecting)
        await this.reloadData()
    }

    getConfigFields() {
        return [
            { type: 'textinput', id: 'apiKey', label: 'API-key', width: 12 },
            { type: 'textinput', id: 'graphQlUrl', label: 'GraphQL Endpoint', default: 'https://graphql.eu.screencloud.com/graphql', width: 12 },
            {
                type: 'textinput',
                id: 'brokenIdsDisplay',
                label: 'Blacklisted channel IDs (filled automatically)',
                tooltip: 'IDs that caused errors. Clear and save to reset.',
                width: 12,
            },
        ]
    }

    async reloadData() {
        if (!this.config.brokenIdsDisplay || this.config.brokenIdsDisplay.trim() === '') {
            this.config.brokenIds = []
        } else {
            this.config.brokenIds = this.config.brokenIdsDisplay
                .split(',')
                .map((id) => id.trim())
                .filter((id) => id !== '')
        }

        if (!this.config.apiKey) {
            this.updateStatus(InstanceStatus.ConfigError, 'No API-key')
            return
        }

        const endpoint = this.config.graphQlUrl || 'https://graphql.eu.screencloud.com/graphql'

        try {
            const res = await axios({
                method: 'post',
                url: endpoint,
                headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    query: `query { 
                        allScreens(first: 50) { nodes { id name content } } 
                        allChannels(first: 100) { nodes { id name } } 
                    }`,
                }),
                timeout: 15000,
            })

            const d = res.data?.data
            if (d) {
                const brokenSet = new Set(this.config.brokenIds || [])
                let filteredChannels = []
                let mappedScreens = []
                const seenNames = new Set()

                if (d.allChannels?.nodes) {
                    d.allChannels.nodes.forEach((c) => {
                        if (brokenSet.has(c.id)) return

                        const nameLower = c.name?.toLowerCase().trim()
                        if (!nameLower || ['blank_channel', 'brand_channel'].includes(nameLower)) return

                        if (!seenNames.has(nameLower)) {
                            seenNames.add(nameLower)
                            filteredChannels.push({ id: c.id, label: c.name.trim() })
                        }
                    })
                    filteredChannels.sort((a, b) => a.label.localeCompare(b.label))
                }

                if (d.allScreens?.nodes) {
                    mappedScreens = d.allScreens.nodes.map((node) => ({
                        id: node.id || 'unknown',
                        label: node.name || 'unknown screen',
                    }))
                    mappedScreens.sort((a, b) => a.label.localeCompare(b.label))
                    
                    d.allScreens.nodes.forEach(node => {    
                        if (node.id) {
                            let actualId = 'offline'; 
                            
                            if (node.content) {
                                actualId = node.content;
                                if (typeof node.content === 'object' && node.content !== null) {
                                    actualId = node.content._ref?.id || node.content.id || JSON.stringify(node.content);
                                }
                            }
                            
                            this.states[node.id] = actualId;
                        }
                    });
                }

                this.contents = filteredChannels
                this.screens = mappedScreens

                this.initActions()
                this.initFeedbacks()
                this.initVariables()
                this.checkFeedbacks();
                
                const unscannedChannels = this.contents.filter(c => !this.scannedIds.has(c.id));

                this.updateStatus(InstanceStatus.Ok)
            }

        } catch (e) {
            this.log('error', `Update failed: ${e.message}`)
            this.updateStatus(InstanceStatus.ConnectionFailure, e.message)
        }
    }

    async markChannelAsBroken(id) {
        if (!id || this.isProcessingBlacklist) return
        this.isProcessingBlacklist = true

        try {
            let currentList = (this.config.brokenIdsDisplay || '')
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s !== '')

            if (!currentList.includes(id)) {
                currentList.push(id)
                this.config.brokenIdsDisplay = currentList.join(', ')
                this.log('warn', `Channel ${id} is broken! Adding to blacklist.`)
                await this.saveConfig(this.config)
            }
        } catch (error) {
            this.log('error', 'Error saving blacklist: ' + error.message)
        } finally {
            setTimeout(() => {
                this.isProcessingBlacklist = false
            }, 2000)
        }
    }

    async runDeepScan(targetScreenId) {
        try {
            if (this.isProcessingBlacklist || !this.contents || this.contents.length === 0) {
                this.log('warn', 'Deep-Scan aborted: No channels available or scan is already in progress.');
                return;
            }

            if (!this.screens || this.screens.length === 0) {
                this.log('warn', 'Deep-scan aborted: No screen found as test target.');
                return;
            }

            const testScreenId = targetScreenId || this.screens[0].id;
            const testScreenObj = this.screens.find(s => s.id === testScreenId);
            const testScreenName = testScreenObj ? testScreenObj.label : 'Unknown Target';

            this.log('info', `Starting active deep scan (switch test) for ${this.contents.length} channels on screen '${testScreenName}'. Please wait...`);
           
            this.isProcessingBlacklist = true;
            this.isScanningActive = true;              
            this.scanProgressValue = '0%';             
            this.initVariables();  
            this.checkFeedbacks('deep_scan_active');

            let brokenFound = false;
            let currentList = (this.config.brokenIdsDisplay || '').split(',').map((s) => s.trim()).filter((s) => s !== '');
            const endpoint = this.config.graphQlUrl || 'https://graphql.eu.screencloud.com/graphql';

            const total = this.contents.length;
            
            for (let i = 0; i < total; i++) {          
                const channel = this.contents[i];

                const percent = Math.round(((i + 1) / total) * 100); 
                this.scanProgressValue = percent + '%';              
                this.initVariables(); 

                try {
                    const response = await axios({
                        method: 'post',
                        url: endpoint,
                        headers: { 
                            'Authorization': `Bearer ${this.config.apiKey}`, 
                            'Content-Type': 'application/json' 
                        },
                        data: JSON.stringify({
                            query: `mutation($i: SetScreenContentInput!) { setScreenContent(input: $i) { clientMutationId } }`,
                            variables: { 
                                i: { 
                                    screenId: testScreenId, 
                                    contentId: channel.id, 
                                    contentType: 'CHANNEL' 
                                } 
                            }
                        }),
                        timeout: 5000,
                    });

                    if (response.data?.errors?.some(e => e.message.includes('NOT_FOUND'))) {
                        if (!currentList.includes(channel.id)) {
                            currentList.push(channel.id);
                            brokenFound = true;
                            this.log('warn', `Deep-scan: Zombie '${channel.label}' found (NOT_FOUND). Blacklisted.`);
                        }
                    }
                } catch (err) {
                    const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
                    if (errMsg.includes('NOT_FOUND') || err.message === 'NOT_FOUND') {
                        if (!currentList.includes(channel.id)) {
                            currentList.push(channel.id);
                            brokenFound = true;
                            this.log('warn', `Deep-scan: Zombie '${channel.label}' interepted (NOT_FOUND). Blacklisted.`);
                        }
                    } else {
                        this.log('debug', `Deep-scan skips '${channel.label}'. API reports: ${errMsg}`);
                    }
                }

                await new Promise((resolve) => setTimeout(resolve, 600));
            }

            this.isScanningActive = false;            
            this.scanProgressValue = 'Done';          
            this.initVariables(); 
            this.checkFeedbacks();
            this.reloadData();

            if (brokenFound) {
                this.config.brokenIdsDisplay = currentList.join(', ');
                this.log('info', 'Deep-scan done! Zombies blacklisted. Reloading module...');
                await this.saveConfig(this.config);
            } else {
                this.log('info', 'Deep-scan done! All channels have passed switching test.');
            }

        } catch (fatalError) {
            this.log('error', `CRASH PREVENTED in runDeepScan: ${fatalError.message}`);
            this.log('debug', `CRASH TRACE: ${fatalError.stack}`);
        } finally {
            this.isProcessingBlacklist = false;
        }
    }

    initActions() {
        this.setActionDefinitions(getActions(this))
    }

    initFeedbacks() {
        this.setFeedbackDefinitions(getFeedbacks(this))
    }

    initVariables() {
        variables.updateVariables(this)
    }
}

runEntrypoint(ScreenCloudInstance, [])