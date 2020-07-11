const getActiveTabs = () =>
  new Promise(resolve =>
    chrome.tabs.query({ active: true, currentWindow: true }, resolve)
  );

const attach = target =>
  new Promise(resolve => chrome.debugger.attach(target, "1.2", resolve));

const detach = target =>
  new Promise(resolve => chrome.debugger.detach(target, resolve));

const sendCommand = (target, method, params) =>
  new Promise(resolve =>
    chrome.debugger.sendCommand(target, method, params, resolve)
  );

const b64toBlob = (base64, type = "image/npg") =>
  fetch(`data:${type};base64,${base64}`).then(res => res.blob());

const capture = async target => {
  const highlightConfig = {
    contentColor: {
      r: 50,
      g: 168,
      b: 82,
      a: 0.5
    }
  };
  await sendCommand(target, "DOM.enable");
  await sendCommand(target, "Overlay.enable");
  await sendCommand(target, "Overlay.setInspectMode", {
    mode: "captureAreaScreenshot",
    highlightConfig
  });

  return new Promise(resolve => {
    const onEvent = async (_source, method, params) => {
      if (method !== "Overlay.screenshotRequested") {
        return;
      }

      chrome.debugger.onEvent.removeListener(onEvent);

      const { viewport: clip } = params;
      const { data } = await sendCommand(target, "Page.captureScreenshot", {
        clip
      });

      const blob = await b64toBlob(data);
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename: "capture.png" }, resolve);
    };

    chrome.debugger.onEvent.addListener(onEvent);
  });
};

const onBrowserAction = async () => {
  const [tab] = await getActiveTabs();
  if (!tab || !tab.id) {
    return;
  }

  const debuggee = { tabId: tab.id };
  await attach(debuggee);
  await capture(debuggee);
  await detach(debuggee);
};

chrome.browserAction.onClicked.addListener(onBrowserAction);
