const {ipcRenderer } = require('electron')



window.addEventListener('DOMContentLoaded', () => {
    const refreshButton = document.querySelector('#refresh-button')
    const configButton = document.querySelector('#config-button')
    const manageBacButton = document.querySelector('#managebac-button')
    const tableContainer = document.querySelector('#table-container')
    const resetButton = document.querySelector('#reset-button')

    const classidButton = document.querySelector('#classid-button')

    var table = document.createElement('div');

    table.innerHTML=ipcRenderer.sendSync('getOverallTableCache');
    tableContainer.innerHTML=null
    tableContainer.appendChild(table)
    document.title=document.title+" (未更新)"

    ipcRenderer.send('getRefreshState');

    classidButton.addEventListener('click', () => {
        ipcRenderer.send('showClassid');
    });

    refreshButton.addEventListener('click', () => {
        console.log(ipcRenderer.sendSync('getOverallTable'))
        table.innerHTML=ipcRenderer.sendSync('getOverallTable');
        tableContainer.innerHTML=null
        tableContainer.appendChild(table)
        document.title="ManageMyScore | 总成绩"
    });

    configButton.addEventListener('click', () => {
        ipcRenderer.send('openConfig');
    });

    manageBacButton.addEventListener('click', () => {
        ipcRenderer.send('openManagebac');
    });

    resetButton.addEventListener('click', () => {
        ipcRenderer.send('resetManagebac');
    });

    ipcRenderer.on('refreshButton', (event,arg) => {
        switch(arg){
            case 0:
            refreshButton.innerHTML="刷新";
            refreshButton.removeAttribute("disabled");
            break;
            
            case 1:
            refreshButton.innerHTML="刷新中...";
            refreshButton.setAttribute("disabled",true);
            break;

            case 2:
            refreshButton.innerHTML="正在初始化...";
            refreshButton.setAttribute("disabled",true);
            break;

            case 3:
            refreshButton.innerHTML="需要重启程序!";
            refreshButton.setAttribute("disabled",true);
            break;

        }
    });
});
