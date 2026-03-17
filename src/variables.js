module.exports = {
    updateVariables(self) {
        const variables = []
        const values = {}
        
		variables.push({
            name: 'Deep Scan Status',
            variableId: 'scanning'
        })
        variables.push({
            name: 'Deep Scan Progress',
            variableId: 'scan_progress'
        })

        values['scanning'] = (self.isScanningActive || false).toString();
        values['scan_progress'] = self.scanProgressValue || '0%';

        if (self.screens) {
            self.screens.forEach(s => {
                const varId = `screen_${s.label.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_status`
                variables.push({
                    name: `Status for screen: ${s.label}`,
                    variableId: varId
                })
            
                const currentContentId = self.states[s.id]
                const contentName = self.contents.find(c => c.id === currentContentId)?.label || 'Unknown'
            
                values[varId] = contentName
            })
        }
        
        self.log('debug', `Check custom labels. Amount: ${Object.keys(self.customLabels || {}).length}`);
        
        if (self.customLabels) {
            for (const [vName, data] of Object.entries(self.customLabels)) {
                self.log('debug', `Create variable for: ${vName}`);
        
                variables.push({
                    name: `Custom Label: ${vName}`,
                    variableId: vName 
                });
        
                const screen = self.screens.find(s => s.id === data.screenId);
                const screenName = screen ? screen.label : 'Unknown screen';
        
                const targetChannel = self.contents.find(c => c.id === data.contentId);
                const targetChannelLabel = targetChannel ? targetChannel.label : 'Unbekannt';
        
                values[vName] = `${screenName}: ${targetChannelLabel}`;
            }
        }

        self.setVariableDefinitions(variables)
        self.setVariableValues(values)
    }
}