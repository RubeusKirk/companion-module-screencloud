module.exports = {
    getFeedbacks: function (self) {
        const screenChoices = self.screens && self.screens.length > 0 
            ? self.screens 
            : [{ id: 'none', label: 'loading screens...' }];
            
        const contentChoices = self.contents && self.contents.length > 0 
            ? self.contents 
            : [{ id: 'none', label: 'loading content...' }];

        return {
            
            content_active: {
                type: 'boolean',
                name: 'Color active channel',
                defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
                options: [
                    { type: 'dropdown', label: 'Screen', id: 'screenId', default: screenChoices[0].id, choices: screenChoices },
                    { type: 'dropdown', label: 'Content', id: 'contentId', default: contentChoices[0].id, choices: contentChoices },
                    { type: 'textinput', label: 'Variable name (e.g. ch1)', id: 'varName', default: '' }
                ],
                callback: (fb) => {
                    if (fb.options.varName) {
                        const vName = fb.options.varName.trim().toLowerCase().replace(/[^a-z0-9]/gi, '_');
                        if (vName.length > 1) {
                            if (!self.customLabels[vName] ||
                                self.customLabels[vName].contentId !== fb.options.contentId ||
                                self.customLabels[vName].screenId !== fb.options.screenId) {

                                self.customLabels[vName] = {
                                    screenId: fb.options.screenId,
                                    contentId: fb.options.contentId
                                };

                                setTimeout(() => { self.initVariables(); }, 100);
                            }
                        }
                    }
                    const aktuell = self.states[fb.options.screenId];
                    return aktuell === fb.options.contentId;
                }
            },

            deep_scan_active: {
                type: 'boolean',
                name: 'Deep-scan running',
                description: 'Changes background color while scan is active.',
                defaultStyle: {
                    bgcolor: 0xff0000, 
                    color: 0xffffff,  
                },
                options: [],
                callback: () => {
                    return self.isScanningActive === true;
                }
            }
            
        };
    }
};