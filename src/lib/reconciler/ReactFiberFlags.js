import {
    enableCreateEventHandleAPI,
    enableEffectEventMutationPhase,
} from "../shared/ReactFeatureFlags";

// render阶段添加的标记，表示当前的 fiber 对象需要进行 DOM 插入操作
export const NoFlags = /*                      */ 0b0000000000000000000000000000000;
export const PerformedWork = /*                */ 0b0000000000000000000000000000001;
export const Placement = /*                    */ 0b0000000000000000000000000000010;
// hook的标记
export const Passive = /*                      */ 0b0000000000000000000100000000000;
export const PassiveStatic = /*                */ 0b0000000100000000000000000000000;
export const Update = /*                       */ 0b0000000000000000000000000000100;
export const ChildDeletion = /*                */ 0b0000000000000000000000000010000;
export const ContentReset = /*                 */ 0b0000000000000000000000000100000;
export const PassiveMask = Passive | ChildDeletion;
export const Ref = /*                          */ 0b0000000000000000000001000000000;
export const Snapshot = /*                     */ 0b0000000000000000000010000000000;
export const Visibility = /*                   */ 0b0000000000000000010000000000000;

export const BeforeMutationMask = Snapshot | Update;

export const MutationMask =
    Placement | Update | ChildDeletion | Ref | Visibility;

export const LayoutMask = Update | Ref | Visibility;
