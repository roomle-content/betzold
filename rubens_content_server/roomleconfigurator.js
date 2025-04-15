/**
 * Roomle Local Content Server License
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), 
 * to use, copy, modify, and distribute copies of the Software, subject to the following conditions:
 * 
 * 1. The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * 2. The Software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, 
 *    fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other 
 *    liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the Software or the use or other dealings 
 *    in the Software.
 * 
 * Roomle GmbH
 * 
 * -------------------------------------------------------------------------------
 * 
 * RLCS Client Logic
 *
 * This is the client side of the Roomle Rubens Local Content Server.
 * This instantiates the RoomleConfigurator and provides a WebSocket connection to the server side of the RLCS, listening for changes in local content.
 * The file is provided as is and can be used as a starting point for your own implementation.
 * Normally, this file is served from the VS Code extension, but you can apply changes and your own custom behaviour here,
 * but other files of the RLCS can be subject of change in between the versions of the VS Code extension and it might
 * happen that compatibility is lost. In such cases, you can delete this file or replace it with the newer version from the VS Code 
 * extension using the command "Roomle: Get Rubens Local Content Server Local Files" and reimplement your changes.
 * If this file is present, it is taken. If this file is deleted or renamed, the bunlded version from the VS Code extension is taken.
 *  
 */

import RoomleConfiguratorApi from "/node_modules/@roomle/embedding-lib/roomle-embedding-lib.es.min.js";
import {
    applyPageTitle,
    checkPartListOnPartListUpdate,
    copyCurrentConfigurationToClipboard,
    copyPartListToClipboard,
    displayPartListButtonAction,
    doRandomInteraction,
    getInitData,
    interactRandomlyLoopButtonAction,
    logError,
    logInfo,
    partListPrintout,
    pasteConfigurationFromClipboard,
    pasteLastCopiedConfiguration,
    printKernelMsgs,
    RECONNECT_INTERVAL,
    resolveSettings,
    showTextContentInNewTab,
    showCurrentConfigurationInNewTab,
    showPartListInNewTab,
} from './utils.js';

const serverPort = window.location.port;


/** The RoomleConfigurator instance */
let configurator = undefined;
/** WebSocket connection to the RLCS */
let socket = undefined;

let clientSettings = undefined;

connectToWebSocketServer();

// Instantiate the Rubens configurator.
startConfigurator();

let originalOnPartListUpdate = undefined;
let selectedComponentRuntimeIds = [];
let lastPartList = undefined;
async function startConfigurator() {

    // get the settings from the settings.project.js and settings.user.js file
    clientSettings = await resolveSettings();

    const initData = getInitData(clientSettings, window.location);
    const initId = initData.id;
    delete initData.id;

    // Insantiate and expose the RoomleConfigurator object globally, so that it is accessible from the browser console at the top level.
    configurator = await RoomleConfiguratorApi.createConfigurator(
        clientSettings.settings.configuratorId,
        document.getElementById("configurator-container"),
        initData, // the initial configuration
    );
    window.RoomleConfigurator = configurator.extended;


    // Provide the onCheckExternalCache callback to return data from the content server.
    configurator.global.callbacks.onCheckExternalCache = async (url, method, ...otherArgs) => {
        return getLocalContent(url);
    };

    // TODO: Implement this further
    configurator.global.callbacks.onKernelMsg = (type, msg, { componentId, rapiId, parentId }) => { handleOnKernelMsg(type, msg, componentId, rapiId, parentId); };

    configurator.ui.loadObject(initId);

    originalOnPartListUpdate = configurator.extended.callbacks.onPartListUpdate;
    configurator.extended.callbacks.onPartListUpdate = async (partList, hash) => {
        originalOnPartListUpdate(partList, hash);
        window.RoomleConfigurator.partList = partList;
        lastPartList = partList;
        const failedChecks = checkPartListOnPartListUpdate(partList, hash, clientSettings.settings, htmlElements.partListStatus);
        socket.send(JSON.stringify(
            {
                action: 'partListUpdate',
                configuration: JSON.parse(await configurator.extended.getCurrentConfiguration()),
                partList: partList,
                partListFailedChecks: failedChecks,
                hash: hash,
            }
        ));
        partListPrintout(lastPartList, selectedComponentRuntimeIds, htmlElements.partListPrintout, clientSettings.settings);
    };

    applyPageTitle(document, getInitData(clientSettings, window.location).id ?? '');

    RoomleConfigurator.callbacks.onSelectionChange = (arg0, arg1, arg2, selections) => { handleOnSelectionChange(selections); };
    RoomleConfigurator.callbacks.onSelectionCancel = () => { handleOnSelectionChange([]); };

    setTimeout(() => { afterFinishInitialLoad(); }, 3000);
};

// Interact with the HTML page elements in index.html.
let htmlElements = undefined;
document.addEventListener('DOMContentLoaded', (event) => {
    htmlElements = {
        showConfiguration: document.getElementById("showConfiguration"),
        confToClipboard: document.getElementById("confToClipboard"),
        confFromClipboard: document.getElementById("confFromClipboard"),
        lastCopiedFromClipboard: document.getElementById("lastCopiedFromClipboard"),
        watchPrintout: document.getElementById("watchPrintout"),
        errorsPrintout: document.getElementById("errorsPrintout"),
        partListStatus: document.getElementById("partListStatus"),
        showPartList: document.getElementById("showPartList"),
        copyPartList: document.getElementById("copyPartList"),
        doRandomInteraction: document.getElementById("doRandomInteraction"),
        loopRandomInteraction: document.getElementById("loopRandomInteraction"),
        randomInteractionResult: document.getElementById("randomInteractionResult"),
        displayPartList: document.getElementById("displayPartList"),
        partListPrintout: document.getElementById("partListPrintout"),
        contentSource: document.getElementById("contentSource"),
        switchContentSource: document.getElementById("switchContentSource"),
        selectionNavPanel: document.getElementById("selectionNavPanel"),
        generateHOMAGiXExport: document.getElementById("generateHOMAGiXExport"),
    };
    htmlElements.showConfiguration.addEventListener('click', () => { showCurrentConfigurationInNewTab(configurator); });
    htmlElements.confToClipboard.addEventListener('click', () => { copyCurrentConfigurationToClipboard(configurator, navigator); });
    htmlElements.confFromClipboard.addEventListener('click', () => { pasteConfigurationFromClipboard(configurator, navigator, document); });
    htmlElements.lastCopiedFromClipboard.addEventListener('click', () => { pasteLastCopiedConfiguration(configurator, document); });
    htmlElements.copyPartList.addEventListener('click', () => { copyPartListToClipboard(navigator); });
    htmlElements.showPartList.addEventListener('click', () => { showPartListInNewTab(lastPartList ?? {}); });
    htmlElements.doRandomInteraction.addEventListener('click', () => { doRandomInteraction(configurator, htmlElements.randomInteractionResult); });
    htmlElements.loopRandomInteraction.addEventListener('click', () => { interactRandomlyLoopButtonAction(configurator, clientSettings.settings, htmlElements.loopRandomInteraction, htmlElements.randomInteractionResult); });
    htmlElements.displayPartList.addEventListener('click', () => { displayPartListButtonAction(htmlElements.displayPartList, htmlElements.partListPrintout); });
    htmlElements.switchContentSource.addEventListener('click', () => { switchContentSource(); });
    htmlElements.generateHOMAGiXExport.addEventListener('click', () => { generateHOMAGiXExport(); });
});

function afterFinishInitialLoad() {
    if (clientSettings.settings.defaultPartListDisplayStatus) {
        displayPartListButtonAction(htmlElements.displayPartList, htmlElements.partListPrintout, true);
    }
    switchContentSource(true);
}

// Watcher

async function handleOnSelectionChange(selection) {
    let watchResult = '';
    let selectionWatchPanelContent = '';

    // print selected component info to the watchPrintout
    for (const selectedComponent of selection) {
        const applicableWatchers = clientSettings.watchers.filter(watcher => {
            if (watcher.componentIds.indexOf('*') > -1) { return true; }
            else if (watcher.componentIds.indexOf(selectedComponent.componentId) > -1) { return true; }
            else { return false; }
        });
        const watchedKeys = applicableWatchers.map(watcher => watcher.keys).flat();
        const keyValuePairs = selectedComponent.parameters.filter(parameter => (watchedKeys.indexOf(parameter.key) > -1) || watchedKeys.indexOf('*') > -1).map(parameter => { return { key: parameter.key, value: parameter.value }; });
        watchResult += `
        <code>
            ${selectedComponent.componentId} (${selectedComponent.id})<br>
            &nbsp;&nbsp;position: {${selectedComponent.position.x}, ${-selectedComponent.position.y}, ${selectedComponent.position.z}}<br>
            &nbsp;&nbsp;rotation: {${selectedComponent.rotation.x}, ${-selectedComponent.rotation.y}, ${selectedComponent.rotation.z}}<br>
            ${keyValuePairs.length ? `&nbsp;&nbsp;watched parameters: {${keyValuePairs.map(pair => `<br>&nbsp;&nbsp;&nbsp;&nbsp;"${pair.key}": "${pair.value}"`).join(',')}<br>&nbsp;&nbsp;}<br>` : ''}
        </code>
        `;
    }

    // create dock hierarchy navigation buttons
    if (selection.length === 1 && clientSettings.settings.showNavigationPanel) {
        const navSubject = selection[0];
        const parentComponent = navSubject.parentId ? await RoomleConfigurator.getComponent(navSubject.parentId) : null;
        if (parentComponent.componentId || navSubject.childIds.length) {
            selectionWatchPanelContent = '';
            if (parentComponent.componentId) {
                selectionWatchPanelContent += `<small>Parent:</small><button style="pointer-events: all;" onclick="RoomleConfigurator.selectComponent(${navSubject.parentId})"><small>${parentComponent.componentId} (${parentComponent.id})</small></button><br>`;
            }
            else {
                // add empty line so that the children stay in one place if there is no parent
                selectionWatchPanelContent += '<br>';
            }
            if (navSubject.childIds.length) {
                selectionWatchPanelContent += `<small>Children:</small>`;
                for await (const childId of navSubject.childIds) {
                    const childComponent = await RoomleConfigurator.getComponent(childId);
                    selectionWatchPanelContent += `<button style="pointer-events: all;" onclick="RoomleConfigurator.selectComponent(${childId})"><small>${childComponent.componentId} (${childComponent.id})</small></button>`;
                }
            }
        }
        else {
            selectionWatchPanelContent = '';
        }
    }
    htmlElements.watchPrintout.innerHTML = watchResult;
    htmlElements.selectionNavPanel.innerHTML = selectionWatchPanelContent;
    selectedComponentRuntimeIds = selection.length > 0 ? selection.map(component => component.id) : [];
    partListPrintout(lastPartList, selectedComponentRuntimeIds, htmlElements.partListPrintout, clientSettings.settings);
}

// Content Side Loading

/**
 * Clear the external cache and reload the current configuration with new content.
 */
async function clearCacheAndReloadConfigurator() {
    logInfo('Received reload command from server. Clearing cache and reloading configurator.');
    const configuration = await configurator.extended.getCurrentConfiguration();
    await configurator.extended.cleanup({
        resetApiCache: true,
        resetCoreCache: true,
        resetMeshCache: true,
    });
    await configurator.extended.loadConfiguration(configuration);
}

/**
 * Provides the result for the onCheckExternalCache callback of the RoomleConfigurator.
 * If an ID which hasn't been requested yet is requested, the callback onCheckExternalCache is called.
 * Content modifiers can be applied here.
 * null if content not provided locally; otherwise { 'component(s)/item(s)/material(s)...': []/{} } 
 */
async function getLocalContent(url) {
    if (clientSettings.settings.useLiveContent) { return null; }
    const contentUrl = 'http://localhost:' + serverPort + '/content' + url;
    const response = await fetch(contentUrl);
    if (response.ok) {
        // check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const json = await response.json();
            applyModifier(json, clientSettings);
            return json;
        }
        else {
            return null;
        }
    }
}

function switchContentSource(onlySwitchLabel = false) {
    if (!onlySwitchLabel) {
        clientSettings.settings.useLiveContent = !clientSettings.settings.useLiveContent;
        clearCacheAndReloadConfigurator();
    }
    if (clientSettings.settings.useLiveContent) {
        htmlElements.contentSource.innerHTML = '<small style="color: red"><b>LIVE</b></small>';
    }
    else {
        htmlElements.contentSource.innerHTML = '<small>Local</small>';
    }
}

/**
 * Modify the content before it is sideloaded into the configurator.
 * @param {*} checkExternalCachePayload 
 */
function applyModifier(checkExternalCachePayload) {
    if (checkExternalCachePayload.component) {
        clientSettings?.applyComponentModifier(checkExternalCachePayload.component.configuration, clientSettings.settings);
        checkExternalCachePayload.component.configuration = JSON.stringify(checkExternalCachePayload.component.configuration);
    }
    if (checkExternalCachePayload.components) {
        checkExternalCachePayload.components.forEach((component) => {
            clientSettings?.applyComponentModifier(component.configuration, clientSettings.settings);
            component.configuration = JSON.stringify(component.configuration);
        });
    }
}




// WebSocket Connection Handling

/**
 * Entry point for incoming WebSocket message handling.
 * @param {MessageEvent} event as stringified JSON object
 */
async function handleWebSocketMessage(event) {
    // check if message is a stringified object
    if (event.data[0] === '{' && event.data[event.data.length - 1] === '}') {
        const eventData = JSON.parse(event.data);
        if (eventData.action === 'reload') { clearCacheAndReloadConfigurator(); }
    }
}

/**
 * Handle connect, disconect and message events of the WebSocket connection.
 */
function connectToWebSocketServer() {
    try {
        logInfo(`Trying to establish a WebSocket connection to ws://localhost:${serverPort}`);
        socket = new WebSocket(`ws://localhost:${serverPort}`);
        socket.addEventListener('open', (event) => { logInfo('Connection successfully established.'); socket.send('Browser reconnected.'); });
        socket.addEventListener('message', (event) => { handleWebSocketMessage(event); });
        // not useful atm
        // socket.addEventListener('error', (event) => { logError(event); });
        socket.addEventListener('close', (event) => { reconnectWebSocket(event); });
    }
    catch (e) {
        logError('Failed to establish WebSocket connection.', e);
    }
}

async function reconnectWebSocket(event) {
    logInfo(`WebSocket connection ended. Reconnecting in ${RECONNECT_INTERVAL / 1000} seconds.`);
    await new Promise(resolve => setTimeout(resolve, RECONNECT_INTERVAL));
    connectToWebSocketServer();
}

const kernelMsgs = [];
function handleOnKernelMsg(type, msg, componentId, rapiId, parentId) {
    // Show kernel messages for 5 seconds in the browser window
    const parsedMsgCodeMatch = msg.match(/\[\d\d\d\d\]/);
    const code = parsedMsgCodeMatch ? parsedMsgCodeMatch[0] : '';

    const kernelMsg = {
        type: type,
        code: code,
        componentId: componentId,
        msg: code ? msg.split(code)[1].trim() : msg,
    };

    kernelMsgs.push(kernelMsg);
    printKernelMsgs(kernelMsgs, htmlElements.errorsPrintout, clientSettings.settings.ignoreKernelMessagesDisplayByCode);
    setTimeout(() => {
        kernelMsgs.splice(kernelMsgs.indexOf(kernelMsg), 1);
        printKernelMsgs(kernelMsgs, htmlElements.errorsPrintout, clientSettings.settings.ignoreKernelMessagesDisplayByCode);
    }, clientSettings.settings.kernelMessagegDisplayTime);
}



async function generateHOMAGiXExport() {
    const rawXml = await RoomleConfigurator.generateHOMAGiXExport();
    // prettify the XML stringified to HTML and show it in a new tab
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(rawXml, "text/xml");
    const serializer = new XMLSerializer();
    const xmlString = serializer.serializeToString(xmlDoc);
    const xmlStringPrettified = xmlString.replace(/(>)(<)/g, '$1\n$2').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    showTextContentInNewTab(`<pre>${xmlStringPrettified}</pre>`, 'HOMAGiX Export');
}
