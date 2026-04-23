chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'quick-capture') {
    chrome.windows.create({
      url: 'quick-capture.html',
      type: 'popup',
      width: 480,
      height: 200,
      focused: true,
    });
  }
});
