const {ipcRenderer } = require('electron')



window.addEventListener('DOMContentLoaded', () => {
    const refreshButton = document.querySelector('#refresh-button')
    const configButton = document.querySelector('#config-button')
    const manageBacButton = document.querySelector('#managebac-button')
    const tableContainer = document.querySelector('#table-container')
    const resetButton = document.querySelector('#reset-button')

    var table = document.createElement('div');

    table.innerHTML=ipcRenderer.sendSync('getOverallTableCache');
    tableContainer.innerHTML=null
    tableContainer.appendChild(table)
    document.title=document.title+" (未更新)"

    refreshButton.innerHTML="正在初始化...";
    refreshButton.setAttribute("disabled",true);

    ipcRenderer.send('askRefreshButton');

    refreshButton.addEventListener('click', () => {
        refreshButton.innerHTML="刷新中...";
        refreshButton.setAttribute("disabled",true);
        table.innerHTML=ipcRenderer.sendSync('getOverallTable');
        refreshButton.innerHTML="刷新";
        refreshButton.removeAttribute("disabled");
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

    ipcRenderer.on('refreshButton//', (arg) => {
        console.log(arg)
        switch(arg){
            case 0:
            refreshButton.innerHTML="刷新";
            refreshButton.setAttribute("disabled",false);
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

    ipcRenderer.on('refreshButton', (arg) => {
        refreshButton.innerHTML="刷新";
        refreshButton.removeAttribute("disabled");
    });

});
