const axios = require('axios');

module.exports = {
    getActions: function (self) {
        
        const screenChoices = self.screens && self.screens.length > 0 
            ? self.screens 
            : [{ id: 'none', label: 'loading screens...' }];
            
        const contentChoices = self.contents && self.contents.length > 0 
            ? self.contents 
            : [{ id: 'none', label: 'loading content...' }];

        return {
            set_screen_content: {
                name: 'change screens/channels',
                options: [
                    { 
                        type: 'dropdown', label: 'Screen', id: 'screenId', 
                        choices: screenChoices, default: screenChoices[0].id
                    },
                    { 
                        type: 'dropdown', label: 'Content', id: 'contentId', 
                        choices: contentChoices, default: contentChoices[0].id
                    }
                ],
                callback: async (event) => {
                    self.log('info', 'button was pushed! Starting API-request...');
                    if (event.options.screenId === 'none' || event.options.contentId === 'none') {
                        self.log('warn', 'Please select a valid screen and content.');
                        return;
                    }
                    try {
                        const response = await axios({
                            method: 'post',
                            url: self.config.graphQlUrl || 'https://graphql.eu.screencloud.com/graphql',
                            headers: { 
                                'Authorization': `Bearer ${self.config.apiKey}`, 
                                'Content-Type': 'application/json' 
                            },
                            data: JSON.stringify({
                                query: `mutation($i: SetScreenContentInput!) { setScreenContent(input: $i) { clientMutationId } }`,
                                variables: { 
                                    i: { 
                                        screenId: event.options.screenId, 
                                        contentId: event.options.contentId, 
                                        contentType: 'CHANNEL' 
                                    } 
                                }
                            })
                        });

                        if (response.data?.errors?.some(e => e.message.includes('NOT_FOUND'))) {
                            throw new Error('NOT_FOUND');
                        }

                        if (response.status === 200) {
                            self.log('info', 'Switching send! Loading status from API...');
                            
                            self.reloadData(); 
                        }
                    } catch (err) {
                        if (err.message === 'NOT_FOUND') {
                            self.log('error', `Channel ${event.options.contentId} is broken! Removing it...`);
                            await self.markChannelAsBroken(event.options.contentId);
                        } else {
                            const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
                            self.log('error', `Network/API error: ${errorMsg}`);
                        }
                    }
                }
            },
            
        trigger_deep_scan: {
                name: 'Deep-scan for dead channels',
                options: [
                    { 
                        type: 'dropdown', 
                        label: 'Target Screen for Scan', 
                        id: 'targetScreenId', 
                        choices: screenChoices, 
                        default: screenChoices[0]?.id
                    }
                ],
                callback: async (event) => {
                    self.runDeepScan(event.options.targetScreenId);
                }
            },
        };
    }
};