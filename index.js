const puppeteer = require('puppeteer');
const store = require("electron-store")
const tableify = require('tableify')

var browser; //后端
var page;

var storage = new store() //存储

var host
var username
var password

const { Menu, ipcMain, dialog, app, BrowserWindow } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

var manageBacWindow; //ManageBac前台
var close; //帮上面那个看看该不该关

var overallWindow; //剩下3个也屈服了
var assignmentsListWindow;
var configWindow;

var blockLoginFailedMessage;

var windowsCounter=0

var data=storage.get("data"); //作业缓存
var subjects;

var progressBar=-1;

function getChromiumExecPath() {
    return puppeteer.executablePath().replace('app.asar', 'app.asar.unpacked');
}

function findWeight(task,categories){
    for (var i of categories) {
        for (var j of task['tags']) {
            if (i['name']==j){
                return i['ratio'];
            }
        }
    }
    dialog.showErrorBox("无法分析权重信息！","我不能理解为啥会这样...");
    return null
}

async function analyseChart(){
    //Make sure browser is on subject's core_tasks page!
    //await page.waitForSelector("#term-set-chart-container");
    return page.evaluate(() => {
        let chart = document.getElementById('term-set-chart-container').getElementsByTagName('div')[0];
        let series = JSON.parse(chart.getAttribute('data-series'));
        let max = parseInt(chart.getAttribute('data-max-value'))
        let tasks = new Array();
        for (let i = 0; i < series.length; i++) {
            tasks.push({
				name: series[i]["name"],
				percentage: parseInt(series[i]["data"][0])/max
			});
      }
    return tasks;
});
}

async function overall(){ //return a web table to render
    var overallTable = [];
    if (data!=null && data!=[]){
    for (var i of data) {
        let seven=0;
        let percent=0;
        let weight=0;
        if (i['tasks']!=null){
        for (var j of i['tasks']) {
            let ratio=findWeight(j,i['categories']);
            if (ratio!=null){
                if (j['score']!=null){
                    if (j['percentage']!=null){
                    weight=weight+ratio
                    percent=percent+ratio*j['percentage'];
                    seven=seven+ratio*j['score'];
                    }
                }
            }
        }
        overallTable.push({
            科目: i["name"],
            MB七分制: (seven/weight).toFixed(1),
            转百分比: (seven/weight/7*100).toFixed(1)+"%",
            MB百分比: (percent/weight*100).toFixed(1)+"%"
        })
    }
}
    return tableify(overallTable)
}else{   
    return tableify({无数据: "",})
}
}

async function run(){
    progressBar=0
    overallWindow.setProgressBar(0);
    //assignmentsListWindow.setProgressBar(0);
    var promises=[];
    var dictionary=[];
    var fail=0
    for (let i = 0; i < subjects.length; i++) {
        promises.push(new Promise((resolve) => {
            (async function () {
                var subject=subjects[i]
                var cat=null;
                var tas=null;
            try{
                var tempPage = await browser.newPage()
                tempPage.goto(host+subject["url"]+"/core_tasks")
                cat = await analyseCategories(tempPage);
                tas = await analyseTasks(tempPage);
                dictionary.push({
                    name: subject["name"],
                    url: subject["url"],
                    categories: cat,
                    tasks: tas
                });
                }catch(error){
                    fail=fail+1;
                    if (fail<=3){
                    dialog.showErrorBox("未能刷新 "+subject["name"]+" 的数据！","这里暂时先空着"); //返回e貌似会有问题？
                    }else if (fail==4){
                    dialog.showErrorBox("未能刷新3科以上的数据！","将停止报告错误..."); //返回e貌似会有问题？
                    }
                }finally{
                    tempPage.close();
                    progressBar=progressBar+1/subjects.length;
                    overallWindow.setProgressBar(progressBar);
                    //assignmentsListWindow.setProgressBar(progressBar);
                    resolve();
                }
            })();  
        }));
    }

    await Promise.all(promises);
    progressBar=-1
    overallWindow.setProgressBar(-1);
    //assignmentsListWindow.setProgressBar(-1);
    data=dictionary
    storage.set('data',dictionary);
}

async function init(){ 
    browser = await puppeteer.launch({ executablePath: getChromiumExecPath(), headless: true });
    page = await browser.newPage();
    try{
        await login();
        await analyseSubjects();
        globalSendMsg("refreshButton",0)
    }catch{
        if(!blockLoginFailedMessage){
            dialog.showErrorBox("登录失败或被中断","请检查登录凭据与密码！或者，等一等...")
            createConfigWindow();
            globalSendMsg("refreshButton",3)
        }
        blockLoginFailedMessage=false;
    }finally{
        page.close();
        console.log("DONE");
    }
}

async function login(){
    
    if (host + '/student'!=page.url()){
        await page.goto(host + '/student');
        if (host + '/student'!=page.url()){
            await page.goto(host + '/student');
            if (host + '/student'!=page.url()){
                await page.type('input[name="login"]',username);
                await page.type('input[name="password"]',password);
                await page.waitForSelector('label[class="boolean optional checkbox"]');
                await page.click('label[class="boolean optional checkbox"');
                await page.click('input[name="commit"]');
                await page.waitForSelector("#menu");
                //storage.set("cookies",await page.cookies());
            }
        }
    }
}

async function analyseSubjects(){
    while (host + '/student'!=page.url()){
        await page.goto(host + '/student')
    }
    await page.waitForSelector("#menu");
    subjects= await (await page.$('#menu')).evaluate((menu) => {
        let list = menu.getElementsByClassName('js-menu-classes-list')[0].getElementsByTagName('ul')[0].getElementsByTagName('li');
        let li = new Array();
        for (let i = 0; i < list.length - 1; i++) {
			let item = list.item(i).getElementsByTagName('a')[0];
			li.push({
				name: item.getElementsByTagName('span')[0].innerHTML,
				url: item.getAttribute('href')
			});
		}
        return li
      }, page.$('#menu'));
}

async function analyseCategories(targetPage){
    await targetPage.waitForSelector("#action-index > main > div.sidebar.drop-down.hidden-mobile");
    console.log("Cata done")
    return targetPage.evaluate(() => {
        var ratio = new Array();
        try{
        let items = document.getElementsByClassName('sidebar-items-list')[0].getElementsByClassName('list-item');
        for (let i = 1; i < items.length; i++) {
            ratio.push({
				name: items[i].getElementsByClassName('cell')[0].getElementsByClassName('label')[0].textContent.trim(), //There're 2 space in the lable! 真就设计鬼才...
				ratio: parseFloat((items[i].getElementsByClassName('cell')[1].textContent).substring(0,3))/100
			});
        }}catch{
            ratio=null;
        }finally
        {
            //咕咕咕!
        }
    return ratio;
});
}

async function analyseTasks(targetPage){
    await targetPage.waitForSelector("#action-index > main > div.content-wrapper > div.content-block");
    console.log("Task done")
    return targetPage.evaluate(() => {
        if(document.getElementsByClassName("content-block")[0].childElementCount>=4){
            let items = document.getElementsByClassName('tasks-list-container')[0].getElementsByClassName('fusion-card-item');
            var tasks = new Array();
        for (let i = 0; i < items.length; i++) {
            var percent = null;
            try{
                let cell = items[i].getElementsByClassName('assessment')[0].getElementsByClassName('flex')[0].getElementsByClassName('cell')[0];
                let percentageInfo = cell.getElementsByClassName('points')[0].textContent.split(" pts")[0];
                var scoreInfo = cell.getElementsByClassName('grade')[0].textContent;
                percent = parseInt(percentageInfo.split("/")[0])/parseInt(percentageInfo.split("/")[1])
            }catch{
                percent = null;
            }finally{
                let tags = new Array();
                let flex = items[i].getElementsByClassName('flex')[0];
                let badge = flex.getElementsByClassName('flex-col')[0].getElementsByClassName('date-badge')[0];
                let stretch = flex.getElementsByClassName('stretch')[0];
                let set = stretch.getElementsByClassName('label-and-due')[0].getElementsByClassName('labels-set')[0]
                let labels = set.getElementsByClassName('label');
                for (let j = 0; j < labels.length; j++) {
                    try{
                        tags.push(labels[j].textContent.trim());
                    }catch{
                        //Do nothing here...
                    }finally{
                        //Do nothing here too...
                    }
                }
                tasks.push({
                    name: stretch.getElementsByClassName('title')[0].querySelector("a").textContent,
                    tags: tags,
                    url: stretch.getElementsByClassName('title')[0].querySelector("a").href,
                    month: badge.getElementsByClassName('month')[0].textContent,
                    day: badge.getElementsByClassName('day')[0].textContent,
                    time: set.getElementsByClassName('flex')[0].getElementsByClassName('due-date')[0].getElementsByClassName('due')[0].textContent,
                    score: parseInt(scoreInfo),
                    percentage: percent
                });
            }
        }
    }else{
        tasks = null;
    }
        return tasks;
});
}

const thumbarButtons=[
{
    tooltip: '总成绩',
    icon: path.join(__dirname, 'icons/analysis.png'),
    click () { createOverallWindow () }
}, {
    tooltip: '作业列表',
    icon: path.join(__dirname, 'icons/list-view.png'),
    //click () { createAssignmentsListWindow() }
}, {
    tooltip: 'ManageBac',
    icon: path.join(__dirname, 'icons/earth.png'),
    click () { manageBacWindow.show() }
}, {
    tooltip: '设置',
    icon: path.join(__dirname, 'icons/setting-two.png'),
    click () { createConfigWindow() }
    }
]

const dockMenu = Menu.buildFromTemplate([
{
    label: '总成绩',
    click () { createOverallWindow () }
}, {
    label: '作业列表',
    //click () { createAssignmentsListWindow() }
}, {
    label: 'ManageBac',
    click () { manageBacWindow.show() }
}, {
    label: '设置',
    click () { createConfigWindow() }
}
]);

function createOverallWindow () {
    if(overallWindow!=null){
        overallWindow.show()
    }else{
    windowsCounter=windowsCounter+1
    overallWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'overall.js')
    }
  })
    overallWindow.setThumbarButtons(thumbarButtons);
    overallWindow.loadFile('overall.html');
}
    overallWindow.on('closed', function () {    
        overallWindow=null
        windowsCounter=windowsCounter-1
        if (windowsCounter==0){
            app.quit();
        }
    })
}

function createConfigWindow() {
    if(configWindow!=null){
        configWindow.show()
    }else{
     windowsCounter=windowsCounter+1
    configWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'config.js')
    }
  })
    configWindow.setThumbarButtons(thumbarButtons);
    configWindow.loadFile('config.html');
}
    configWindow.on('closed', function () {
        configWindow=null
        windowsCounter=windowsCounter-1
        if (windowsCounter==0){
            app.quit();
        }
    })

}

function createAssignmentsListWindow() {
    if(assignmentsListWindow!=null){
        assignmentsListWindow.show()
    }else{
    windowsCounter=windowsCounter+1
    assignmentsListWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'assignmentsList.js')
    }
  })
    assignmentsList.setThumbarButtons(thumbarButtons);
    assignmentsList.loadFile('assignmentsList.html');

    assignmentsListWindow.on('closed', function () {
        assignmentsListWindow=null
        windowsCounter=windowsCounter-1
        if (windowsCounter==0){
            app.quit();
        }
    })

}
}

function createDefaultWindow(){
    var launch=storage.get("launch")
    if (launch==0){
        createOverallWindow();
    }else if (launch==1){
        createAssignmentsListWindow();
    }else if (launch==2){
        manageBacWindow.show();
    }else{
        createOverallWindow();
    }
}

app.whenReady().then(() => {
    if (process.platform === 'darwin') {
        app.dock.setMenu(dockMenu);
    }

    autoUpdater.checkForUpdatesAndNotify();

    manageBacWindow = new BrowserWindow({ //准备好了再创建窗口
        width: 1280,
        height: 800,
        show: false
    })
    manageBacWindow.setThumbarButtons(thumbarButtons);
    manageBacWindow.on("close", function (event) {
        if (!close){
            manageBacWindow.hide();
            event.preventDefault();
        }
    });

    if(storage.get("host")!="" && storage.get("login")!="" && storage.get("password")!=""){
        host=storage.get("host");
        username=storage.get("login");
        password=storage.get("password");
        createDefaultWindow();
        init();
    }else{
        createConfigWindow();
    }

    const argv=process.argv[process.argv.length-1]
    if(argv=="o"){
        createOverallWindow();
    }else if(argv=="a"){
        createAssignmentsListWindow();
    }else if(argv=="m"){
        manageBacWindow.show();
    }else if(argv=="c"){
        createConfigWindow();
    }

    app.on('window-all-closed', function () {
        //因为ManageBac不会被关闭，所以这里不会有任何作用。
        if (process.platform !== 'darwin'){
            blockLoginFailedMessage=true
            app.quit();
    }
    })
        
    app.on('before-quit', function () {
        blockLoginFailedMessage=true
        try{browser.close()}catch{}finally{close=true}
    })

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 1)createDefaultWindow()
    })

    manageBacWindow.loadURL(host + '/student');
})


function globalSendMsg(channel,msg){
    if(overallWindow!=null){
        overallWindow.webContents.send(channel,msg);
    }
    if(assignmentsListWindow!=null){
        assignmentsListWindow.webContents.send(channel,msg);
    }
}

ipcMain.on("getOverallTable",(event) => {
    globalSendMsg("refreshButton",1);
    run().then(() => { 
        overall().then(info => {
            globalSendMsg("refreshButton",0);
            event.returnValue = info;
        });
    });
})

ipcMain.on("getOverallTableCache",(event) => {
    overall().then(info => {
            event.returnValue = info;
        });
});

ipcMain.on("openConfig",(event) => {
    createConfigWindow();
});

ipcMain.on("openManagebac",(event) => {
    manageBacWindow.show();
});

ipcMain.on("openOverall",(event) => {
    createOverallWindow();
});

ipcMain.on("openAssignmentsList",(event) => {
    createAssignmentsListWindow();
});

ipcMain.on("closeConfigWindow",(event,reload) => {
   configWindow.close();
   if (reload){
       app.relaunch();
       app.exit();
    }
});

ipcMain.on("getConfig",(event,key) => {
    event.returnValue=storage.get(key);
});

ipcMain.on("setConfig",(event,key,value) => {
    storage.set(key,value);
});

ipcMain.on("deleteCache",(event,key) => {
    storage.delete("data");
    storage.delete("sujects");
    subjects=null
    data=null
});

ipcMain.on("resetManagebac",(event) => {
    manageBacWindow.loadURL(host + '/student');
});