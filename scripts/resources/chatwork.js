RG = {};
RG.messageSettings = getMessageSettings();
RG.pattern = getMessagePattern();
window.onresize = function () {
    setLoadMorePosition();
}

var watchMessagesInterval = setInterval(function () {
    try {
        setInterval(function () {
            if (RM.id != RG.roomId) {
                openFirstPage();
            }
        }, 300);

        setInterval(function () {
            if (RM.timeline.chat_list.length != RG.chatNum) {
                syncMyMessages();
            }
        }, 300);

        clearInterval(watchMessagesInterval);
    } catch {}
}, 100);

var openMyMessageInterval = setInterval(function () {
    if ($('#_timeLine').length) {
        if (isAnySettingChecked()) {
            openMyMessageContent();
        }
        clearInterval(openMyMessageInterval);
    }
}, 100);

$(document).on('click', '#load-more', function () {
    if ($(this).hasClass('loading-message')) return;
    loadOlderMessages();
});

$(document).on('change', '#message-setting input', function () {
    $('#message-setting').find('input').each(function (_, elem) {
        RG.messageSettings[elem.name] = elem.checked;
    });
    localStorage.rgMessageSettings = JSON.stringify(RG.messageSettings);
    RG.pattern = getMessagePattern();
    handleChangeMessageSetting();
});

function openFirstPage() {
    clearMyMessageContent();
    syncMyMessages();
    scrollToBottom();
}

function syncMyMessages() {
    var firstId = getFirstChatId();
    var lastId = getLastChatId();
    var $myMessageContent = $('#my-message-content');
    var messages = filterMessages(RM.timeline.chat_list);

    if (!firstId || !lastId) {
        clearMyMessageContent();
    }

    messages.forEach(message => {
        switch (true) {
            case message.id < firstId:
                $myMessageContent.prepend(
                    buildMessage(message)
                );
                break;
            case message.id > lastId:
                $myMessageContent.append(
                    buildMessage(message)
                );
                scrollToBottom();
        }
    });

    RG.roomId = RM.id;
    RG.chatNum = RM.timeline.chat_list.length;
    CS.view.bindMessageWrapper($myMessageContent);
    watchMessages(messages);
}

function syncOneMessage(message) {
    var $message = findMessage(message.id);

    if (isDeleted(message)) {
        return $message.remove();
    }

    $message.replaceWith(TimeLineView.prototype.getMessagePanel(message));
}

function watchChange(object, attr, callback) {
    object['_' + attr] = object[attr];

    Object.defineProperty(object, attr, {
        set(value) {
            if (Array.isArray(value) && object[attr].length == value.length) {
                object['_' + attr] = value;
            } else {
                object['_' + attr] = value;
                callback(this);
            }
        },
        get() {
            return object['_' + attr];
        }
    });
}

function watchMessages(messages) {
    messages.forEach(message => {
        watchChange(message, 'msg', syncOneMessage);
        watchChange(message, 'reactions', syncOneMessage);
    });
}

function getMessageSettings() {
    return JSON.parse(localStorage.rgMessageSettings || '{}');
}

function scrollToHeigth(heigth) {
    var timeLine = getMyTimeLineRef();
    timeLine && (timeLine.scrollTop = timeLine.scrollHeight - heigth);
}

function scrollToBottom() {
    var timeLine = getMyTimeLineRef();
    timeLine && (timeLine.scrollTop = timeLine.scrollHeight);
}

function getMyTimeLineRef() {
    return document.getElementById('myTimeLine') || {};
}

function clearMyMessageContent() {
    $('#my-message-content ._message').remove();
}

function getFirstChatId() {
    return $('#my-message-content ._message:first').data('mid') || '';
}

function getLastChatId() {
    return $('#my-message-content ._message:last').data('mid') || '';
}

function handleChangeMessageSetting() {
    if (isAnySettingChecked()) {
        openMyMessageContent();
        openFirstPage();
        syncMyMessages();
    } else {
        closeMyMessageContent();
    }
}

function isAnySettingChecked() {
    var settings = RG.messageSettings;
    return settings.toall || settings.TOALL || settings.myMessage;
}

function loadOlderMessages() {
    var heigth = getMyTimeLineRef().scrollHeight;
    showLoading();
    RM.timeline.loadOld(function () {
        syncMyMessages();
        scrollToHeigth(heigth);
        hideLoading();
    });
}

function buildMessage(message) {
    if (findMessage(message.id).length) {
        return null;
    }

    return TimeLineView.prototype.getMessagePanel(message, {
        showSender: message.isMention == true
    });
}

function findMessage(messageId) {
    return $(`#my-message-content ._message[data-mid="${messageId}"]`);
}

function getMessagePattern() {
    var patterns = new Array();
    var settings = RG.messageSettings;
    var myId = window.MYID;

    if (settings.toall) {
        patterns.push('\\[toall\\]');
    }

    if (settings.TOALL) {
        patterns.push('^TO ALL >>>');
    }
    
    if (settings.myMessage) {
        patterns.push(`\\[rp aid=${myId} to=[0-9-]+\\]|\\[To:${myId}\\]`);
    }

    return RegExp(`(${patterns.join('|')})`);
}

function filterMessages(messages) {
    return messages.filter((message, index) => {
        message.isMyMessage = isMyMessage(message, messages[index - 1]);
        return message.isMyMessage;
    });
}

function isMyMessage(message, prevMessage = null) {
    if (!message || isDeleted(message)) {
        return false;
    }

    if (isMentionMessage(message)) {
        message.isMention = true;
        return true;
    }
    
    return (
        prevMessage &&
        message.mn == false &&
        prevMessage.isMyMessage &&
        message.aid == prevMessage.aid
    );
}

function isMentionMessage(message) {
    if (RG.messageSettings.myMessage) {
        return message.aid == window.MYID || message.msg.match(RG.pattern);
    }

    return message.msg.match(RG.pattern);
}

function isDeleted(message) {
    return message.type == 'delete_message_type' || message.msg == '[deleted]';
}

function openMyMessageContent() {
    var $timeLine = $('#_timeLine');
    var $myTimeLine = $('#myTimeLine');

    if ($myTimeLine.length) {
        $myTimeLine.removeClass('d-none');
    } else {
        $myTimeLine = $(
            `<div id="myTimeLine">
                <div id="load-more">Load messages</div>
                <div id="my-message-content"></div>
            </div>`
        );
        $timeLine.append($myTimeLine);
    }

    setLoadMorePosition();
    $timeLine.find('div:first').addClass('resize');
}

function closeMyMessageContent() {
    $('#myTimeLine').addClass('d-none');
    $('#_timeLine div:first').removeClass('resize');
}

function showLoading() {
    var $loadMore = $('#load-more');

    $loadMore.addClass('loading-message');
    $loadMore.html(`
        <img class="timeLine__loadingImage"
            src="https://assets.chatwork.com/images/loader/img_loader_white.gif"
        >Loading...
    `);
}

function hideLoading() {
    var $loadMore = $('#load-more');

    $loadMore.removeClass('loading-message');
    $loadMore.html('Load messages');
}

function setLoadMorePosition() {
    var $loadMore = $('#load-more');
    var marginLeft = ($('#myTimeLine').width() - $loadMore.width()) / 2;
    $loadMore.css({'margin-left': marginLeft  + 'px'});
}
