/*
 * This file is used to configure the project settings for the configurator. Keep it tracked in your project's git repository.
 */

export const settings = {

    // Configurator ID to load the configurator with. Use your assigned configuratorId.
    // configuratorId: '{enter your configuratorId}',

    // Apply component modifier settings:
    // You can override these booleans in your settings.user.js file based on your immediate needs.
    modifierApplyKeyToLabels: true,
    modifierConcatenateDebugGeometry: true,

    // part list is checked for these keywords and if found, a warning is shown
    partListWarnKeywords: [
        'ERROR',
        'NULL',
        'UNDEFINED',
        'WARNING',
        'TODO',
        'FIXME',
        'NULL',
        'TBD',
    ],

    // how often the random interactions loop should wait for the next one in milliseconds
    randomInteractionsLoopInterval: 3000,

    // whether the part list display should be on by default
    defaultPartListDisplayStatus: true,

    // how long [ms] should kernel messages be displayed in the configurator window before they get removed
    kernelMessagegDisplayTime: 10000,

    // ignore kernel messages in the scene display by their code
    // use for ignoring messages that you don't want to worry about
    ignoreKernelMessagesDisplayByCode: [
        // '[1331]', // function argument shadows variable
        // '[3214]', // object parameter is visible
        // '[3215]', // invalid parameter group
    ],

    // whether to use the navigation panel
    showNavigationPanel: true,


};

// Override the initData coming from the Tenant settings under the configuratorId
export const initData = {
    // id: '{your starting itemId}',
    // id: 'component@{your starting componentId}',
};

/** 
 * Display values of the selected component. Values of matching parameters of the matching components will get printed on the screen.
 */
export const watchers = [
    // Example: Show all keys of any component
    /*
    {
        componentIds: [
            '*'
        ],
        keys: [
            '*'
        ]
    },
    */
];

/**
 * Modify the component definition before it is sideloaded into the configurator. Useful for development. Every modifier should have a settings key.
 * @param {*} component The component definition as a JSON
 * @param {*} settings Resolved settings object. Contains the default settings, overridden with the project settings and then the current user's settings.
 */
export function applyComponentModifier(component, settings) {

    if (settings.modifierApplyKeyToLabels) {
        /**
         * Every parameter label will get prefixed with its key and 
         * every valueObject label will get prefixed with its value.
         */

        if (component.parameters) {
            component.parameters.forEach((p) => {
                if (p.key) {
                    // Show parameter keys at beginning of every parameter.label
                    for (var k in p.labels) {
                        p.labels[k] = p.key + ' : ' + p.labels[k];
                    }
                    // Show value object values at beginning of every valueObject.label
                    if (p.valueObjects) {
                        p.valueObjects.forEach((vo) => {
                            if (vo.value !== undefined && vo.labels) {
                                var val = vo.value;
                                for (var k in vo.labels) {
                                    vo.labels[k] = val + ' : ' + vo.labels[k];
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    if (settings.modifierConcatenateDebugGeometry) {
        /**
         * Joins the debugGeometry into the geometry.
         */
        if (component.debugGeometry) {
            if (!component.geometry) {
                component.geometry = '';
            }
            component.geometry = component.geometry.concat(component.debugGeometry);
        }
    }


    // write more of your custom modifiers here that are relevant for your current project and want to keep persistent
}
