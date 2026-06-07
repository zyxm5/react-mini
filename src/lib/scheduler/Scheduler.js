/**
 * 该文件就是调度器的具体实现
 */

import { push, pop, peek } from "./SchedulerMinHeap";
import {
    frameYieldMs,
    userBlockingPriorityTimeout,
    lowPriorityTimeout,
    normalPriorityTimeout,
    enableRequestPaint,
    enableAlwaysYieldScheduler,
} from "./SchedulerFeatureFlags";
import {
    ImmediatePriority,
    UserBlockingPriority,
    NormalPriority,
    LowPriority,
    IdlePriority,
} from "./SchedulerPriorities";
var needsPaint = false;

// 任务队列,暂时只考虑普通任务，不考虑延时任务
const taskQueue = [];

// 任务 id 计数器
let taskIdCounter = 1;

// 是否有剩余时间
let hasTimeRemaining = true;

let getCurrentTime;
const hasPerformanceNow =
    // $FlowFixMe[method-unbinding]
    typeof performance === "object" && typeof performance.now === "function";

if (hasPerformanceNow) {
    const localPerformance = performance;
    getCurrentTime = () => localPerformance.now();
} else {
    const localDate = Date;
    const initialTime = localDate.now();
    getCurrentTime = () => localDate.now() - initialTime;
}

// This is set while performing work, to prevent re-entrance.
var isPerformingWork = false;

var isHostCallbackScheduled = false;
var maxSigned31BitInt = 1073741823;
function requestPaint() {
    if (enableRequestPaint) {
        needsPaint = true;
    }
}
/**
 * 该函数的作用是为了组装一个任务对象，然后将其放入到任务队列
 * @param {*} priorityLevel 优先级
 * @param {*} callback 是一个需要执行的任务，该任务会在每一帧有剩余时间的时候去执行
 */
export function scheduleCallback(priorityLevel, callback) {
    // 获取当前时间
    const currentTime = getCurrentTime();
    // 接下来设置任务过期时间
    // 在 React 源码中，针对不同的任务类型，设定了不同的过期时间
    // 这中间存在lane模型的优先级和schedule的优先级转换
    let timeout = -1;
    switch (priorityLevel) {
        case ImmediatePriority:
            // Times out immediately
            timeout = -1;
            break;
        case UserBlockingPriority:
            // Eventually times out
            timeout = userBlockingPriorityTimeout;
            break;
        case IdlePriority:
            // Never times out
            timeout = maxSigned31BitInt;
            break;
        case LowPriority:
            // Eventually times out
            timeout = lowPriorityTimeout;
            break;
        case NormalPriority:
        default:
            // Eventually times out
            timeout = normalPriorityTimeout;
            break;
    }

    // 计算出过期时间
    const expirationTime = currentTime + timeout;

    // 组装一个新的任务对象
    const newTask = {
        id: taskIdCounter++,
        callback,
        expirationTime,
        sortIndex: expirationTime, // 回头会根据这个 sortIndex 来进行排序
    };

    // 将新的任务推入到任务队列
    push(taskQueue, newTask);
    if (!isHostCallbackScheduled && !isPerformingWork) {
        // 没有正在执行的任务时，开始调度
        isHostCallbackScheduled = true;
        requestHostCallback();
    }
}
var currentTask = null;
var currentPriorityLevel = NormalPriority;
function workLoop(currentTime) {
    // 获取最新任务
    currentTask = peek(taskQueue);
    while (currentTask !== null) {
        if (!enableAlwaysYieldScheduler) {
            if (
                currentTask.expirationTime > currentTime &&
                shouldYieldToHost()
            ) {
                // 没到任务执行点而且该交还主线程了
                break;
            }
        }
        // 执行callbak
        const callback = currentTask.callback;
        if (typeof callback === "function") {
            // $FlowFixMe[incompatible-use] found when upgrading Flow
            currentTask.callback = null;
            // $FlowFixMe[incompatible-use] found when upgrading Flow
            currentPriorityLevel = currentTask.priorityLevel;
            // $FlowFixMe[incompatible-use] found when upgrading Flow
            const didUserCallbackTimeout =
                currentTask.expirationTime <= currentTime;
            const continuationCallback = callback(didUserCallbackTimeout);
            currentTime = getCurrentTime();
            if (typeof continuationCallback === "function") {
                // 如果返回结果是个函数，立刻停止，交还主线程
                // If a continuation is returned, immediately yield to the main thread
                // regardless of how much time is left in the current time slice.
                // $FlowFixMe[incompatible-use] found when upgrading Flow
                currentTask.callback = continuationCallback;
                return true;
            } else {
                if (currentTask === peek(taskQueue)) {
                    // 如果任务已执行，则推出任务
                    pop(taskQueue);
                }
            }
        } else {
            // 正常退出任务
            pop(taskQueue);
        }
        currentTask = peek(taskQueue);
        if (enableAlwaysYieldScheduler) {
            if (
                currentTask === null ||
                currentTask.expirationTime > currentTime
            ) {
                // This currentTask hasn't expired we yield to the browser task.
                break;
            }
        }
    }
}
let isMessageLoopRunning = false;
const performWorkUntilDeadline = () => {
    if (enableRequestPaint) {
        needsPaint = false;
    }
    if (isMessageLoopRunning) {
        const currentTime = getCurrentTime();
        // Keep track of the start time so we can measure how long the main thread
        // has been blocked.
        startTime = currentTime;

        // If a scheduler task throws, exit the current browser task so the
        // error can be observed.
        //
        // Intentionally not using a try-catch, since that makes some debugging
        // techniques harder. Instead, if `flushWork` errors, then `hasMoreWork` will
        // remain true, and we'll continue the work loop.
        let hasMoreWork = true;
        try {
            hasMoreWork = workLoop(currentTime);
        } finally {
            if (hasMoreWork) {
                // If there's more work, schedule the next message event at the end
                // of the preceding one.
                schedulePerformWorkUntilDeadline();
            } else {
                isMessageLoopRunning = false;
            }
        }
    }
};
let schedulePerformWorkUntilDeadline;
if (typeof localSetImmediate === "function") {
    // 兼容Nodejs和IE使用setImmediate
    // Node.js and old IE.
    // There's a few reasons for why we prefer setImmediate.
    //
    // Unlike MessageChannel, it doesn't prevent a Node.js process from exiting.
    // (Even though this is a DOM fork of the Scheduler, you could get here
    // with a mix of Node.js 15+, which has a MessageChannel, and jsdom.)
    // https://github.com/facebook/react/issues/20756
    //
    // But also, it runs earlier which is the semantic we want.
    // If other browsers ever implement it, it's better to use it.
    // Although both of these would be inferior to native scheduling.
    schedulePerformWorkUntilDeadline = () => {
        setImmediate(performWorkUntilDeadline);
    };
} else if (typeof MessageChannel !== "undefined") {
    // 主流用的时MessageChannel
    // DOM and Worker environments.
    // We prefer MessageChannel because of the 4ms setTimeout clamping.
    const channel = new MessageChannel();
    const port = channel.port2;
    channel.port1.onmessage = performWorkUntilDeadline;
    schedulePerformWorkUntilDeadline = () => {
        port.postMessage(null);
    };
} else {
    // 兜底使用的是setTimeout
    schedulePerformWorkUntilDeadline = () => {
        // $FlowFixMe[not-a-function] nullable value
        setTimeout(performWorkUntilDeadline, 0);
    };
}
function requestHostCallback() {
    if (!isMessageLoopRunning) {
        isMessageLoopRunning = true;
        schedulePerformWorkUntilDeadline();
    }
}

let frameInterval = frameYieldMs;
let startTime = -1;

export function shouldYieldToHost() {
    if (!enableAlwaysYieldScheduler && enableRequestPaint && needsPaint) {
        // Yield now.
        return true;
    }
    const timeElapsed = getCurrentTime() - startTime;
    if (timeElapsed < frameInterval) {
        // The main thread has only been blocked for a really short amount of time;
        // smaller than a single frame. Don't yield yet.
        return false;
    }
    // Yield now.
    return true;
}
