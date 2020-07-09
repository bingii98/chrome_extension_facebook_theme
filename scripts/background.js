chrome.extension.onMessage.addListener(
    function (request) {
        localStorage.theme = request.theme
    }
);