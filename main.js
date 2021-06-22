const { app, BrowserWindow, powerSaveBlocker } = require('electron')

app.disableHardwareAcceleration()

global.twig = require('electron-twig');
global.tmpdir = require('os').tmpdir()
global.tmpdir = global.tmpdir.replace(/\\/g,"/");
global.mountFolder = global.tmpdir+"/mnt";
global.platform = require('os').platform;
global.homedir = require('os').homedir();
global.endOfLine = require('os').EOL;
global.adbDevice = false
global.mounted = false
global.updateAvailable = false
global.installedApps = []
global.currentConfiguration = {}





eval(require('fs').readFileSync(__dirname+'/versioncheck.js')+'');


var tools = require("./tools")


// try {
//     tools.execShellCommand('/home/sam/test.sh');
// }
// catch (e) {
//     console.error(e)
//     return
// }

const { ipcMain } = require('electron')

const id = powerSaveBlocker.start('prevent-display-sleep')
console.log(powerSaveBlocker.isStarted(id))



ipcMain.on('test', async (event, arg) => {

  //external link in browser
  //const { shell } = require('electron')
  //await shell.openExternal('https://electronjs.org')

  // template = require('twig').renderFile('views/error.twig', {}, (error, template) => {
  //     event.reply('log', template);
  // });

  event.reply('log', arg);
  return
})

ipcMain.on('get_installed', async (event, arg) => {
  console.log('get_installed received');
  await tools.getInstalledApps();


  event.reply('get_installed', {success: true, apps: global.installedApps});
  return
})

ipcMain.on('get_device_info', async (event, arg) => {
  console.log('get_device_info received');
  const res = await tools.getDeviceInfo();

  event.reply('get_device_info', res);
  return;
})

ipcMain.on('get_installed_with_updates', async (event, arg) => {
  console.log("get_installed_with_updates received");
  await tools.getInstalledAppsWithUpdates();

  //console.log(apps)

  event.reply('get_installed_with_updates', {"success": true, "apps": global.installedApps});
  return
})

ipcMain.on('check_device', async (event, arg) => {
  console.log('check_device received');
  resp = {success: global.adbDevice}
  event.reply('check_device', resp)

})

ipcMain.on('check_deps', async (event, arg) => {
  console.log('check_deps received');

  await tools.checkDeps()

  // IF DEPS OK LAUNCH CHECKDIVICES OTHERWISE NO
  tools.trackDevices()

  event.reply('check_deps', `{"success":true}`)
})

ipcMain.on('mount', async (event, arg) => {
  await tools.mount();
  await setTimeout(async function(){
    await tools.checkMount()
    event.reply('check_mount', `{"success":${global.mounted}, "mountFolder": "${global.mountFolder}"}`)
    if (global.mounted) {
      tools.updateRcloneProgress()
    }
  }, 2000);
  //tools.setTimeout(updateRcloneProgress, 2000);
  return;
})

ipcMain.on('check_mount', async (event, arg) => {
  await tools.checkMount();
  event.reply('check_mount', `{"success":${global.mounted}, "mountFolder": "${global.mountFolder}"}`)
  if (global.mounted) {
    setTimeout(tools.updateRcloneProgress, 2000);
  }
  return
})

ipcMain.on('start_sideload', async (event, arg) => {
  console.log("start_sideload received");
  if (!global.adbDevice) {
    console.log("Missing device, sending ask_device")
    //tools.returnError("This action cannot be performed without a device attached.")

    event.reply('ask_device', ``)
    return
  }
  event.reply('start_sideload', `{"success":true, "path": "${arg.path}"}`)
  tools.sideloadFolder(arg)
  event.reply('check_device', `{success:true}`)
  return
})


ipcMain.on('get_dir', async (event, arg) => {
  console.log('get_dir received');
  if ((typeof arg === 'string') && arg.endsWith('.apk')) {
    event.reply('ask_sideload', `{"success":true, "path": "${arg}", "update": false}`)
    return
  }

  //if only 1 apk inside, send straight to there

  if (!arg) {
    folder=global.homedir
  } else {
    folder=arg
  }
  list = await tools.getDir(folder)

  incList = []
  list.forEach((item)=>{
    if (!item.isFile) {
      incList.push(item)
    }
    if ((item.isFile && item.name.endsWith(".apk")) || (item.isFile && item.name.endsWith(".obb"))) {
      incList.push(item)
    }
  })



  response = {};
  response.success = true;
  response.list = incList;
  response.path = folder;
  win.webContents.send('get_dir',response);
  //event.reply('get_dir', response)
})



ipcMain.on('update', async (event, arg) => {
  console.log("update received");
  let path = arg
  if (!global.adbDevice) {
    console.log("Missing device, sending ask_device")
    //tools.returnError("This action cannot be performed without a device attached.")

    event.reply('ask_device', ``)
    return
  }
  console.log("for path "+path)
  apkpath = await tools.getApkFromFolder(path);
  event.reply('ask_sideload', `{"success":true, "path": "${apkpath}", "update": true}`)
  return
})

ipcMain.on('filedrop', async (event, arg) => {
  console.log("filedrop received");
  let path = arg
  if (!global.adbDevice) {
    console.log("Missing device, sending ask_device")
    //tools.returnError("This action cannot be performed without a device attached.")

    event.reply('ask_device', ``)
    return
  }
  event.reply('ask_sideload', `{"success":true, "path": "${path}", "update": false}`)
  return
})

ipcMain.on('uninstall', async (event, arg) => {
  console.log("uninstall received");
  resp = await tools.uninstall(arg);
  event.reply('uninstall', {"success":true})
  return
})

// ipcMain.on('change_config', async (event, arg) => {
//     console.log("change_config received");
//     await changeConfig('autoMount', true)
//     event.reply('change_config', {"success":true, config: global.currentConfiguration})
//     return
// })

ipcMain.on('change_config', async (event, { key, val }) => {
  console.log('change_config received', {key, val});
  await tools.changeConfig(key, val)
  event.reply('change_config', {"success":true, config: global.currentConfiguration})
  return
})




function createWindow () {
  global.win = new BrowserWindow({
    width: 1000,
    height: 800,
    title: 'Quest-Sidenoder',
    //frame:false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule:true,
    }
  })
  // win.setMenu(null);

  // win.webContents.openDevTools()

  win.maximize(true)
  win.loadURL(`file://${__dirname}/views/index.twig`)
  twig.view = {
    tmpdir: global.tmpdir,
    platform: global.platform,
    mountFolder: global.mountFolder,
    version: global.version,
    currentConfiguration: global.currentConfiguration
}


  //tools.checkUpdateAvailable()

  setTimeout(function(){ checkVersion(); }, 2000);
  //

}


try {
  tools.reloadConfig();
}
catch (e) {
  returnError('Could not (re)load config file.')
  return
}

// DEFAULT
app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  powerSaveBlocker.stop(id)
  console.log('close')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
