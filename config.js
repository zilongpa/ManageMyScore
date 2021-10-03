const {ipcRenderer} = require('electron')

window.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.querySelector('#save-button')
    const exitButton = document.querySelector('#exit-button')

    const loginInput = document.querySelector('#login-input')
    const passwordInput = document.querySelector('#password-input')
    const oButton = document.querySelector('#o-button')
    const aButton = document.querySelector('#a-button')
    const mButton = document.querySelector('#m-button')
    const hostInput = document.querySelector('#host-input')

    var launch=ipcRenderer.sendSync("getConfig","launch")
    if (launch==0){
        oButton.className="column button-small"
    }else if (launch==1){
        aButton.className="column button-small"
    }else if (launch==2){
        mButton.className="column button-small"
    }else{
        oButton.className="column button-small"
        launch=0
    }

    if(ipcRenderer.sendSync("getConfig","login")!=null){
        loginInput.value=ipcRenderer.sendSync("getConfig","login");
    }
    if(ipcRenderer.sendSync("getConfig","password")!=null){
        passwordInput.value=ipcRenderer.sendSync("getConfig","password");
    }
    if(ipcRenderer.sendSync("getConfig","host")!=null){
        hostInput.value=ipcRenderer.sendSync("getConfig","host");
    }
    

   


    oButton.addEventListener('click', () => {
        launch=0
        oButton.className="column button-small"
        aButton.className="column button-outline button-small"
        mButton.className="column button-outline button-small"
    });
    aButton.addEventListener('click', () => {
        launch=1
        aButton.className="column button-small"
        oButton.className="column button-outline button-small"
        mButton.className="column button-outline button-small"
    });
    mButton.addEventListener('click', () => {
        launch=2
        mButton.className="column button-small"
        aButton.className="column button-outline button-small"
        oButton.className="column button-outline button-small"
    });


    saveButton.addEventListener('click', () => {
        var reload;
        ipcRenderer.send("setConfig","launch",launch)
        if(ipcRenderer.sendSync("getConfig","host")!=hostInput.value || ipcRenderer.sendSync("getConfig","login")!=loginInput.value || ipcRenderer.sendSync("getConfig","password")!=passwordInput.value){
            ipcRenderer.send("deleteCache");
            reload=true
        }
        ipcRenderer.send("setConfig","login",loginInput.value);
        ipcRenderer.send("setConfig","password",passwordInput.value);
        if(hostInput.value==""){
            ipcRenderer.send("setConfig","host","https://huijia.managebac.cn");
        }else{
            ipcRenderer.send("setConfig","host",hostInput.value);
        }
        ipcRenderer.send('closeConfigWindow',reload);
    });


    exitButton.addEventListener('click', () => {
        ipcRenderer.send('closeConfigWindow',false);
});
});