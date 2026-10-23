// Keep payment controls identical across stage engines; ordinary cargo deposits remain automatic.
export function investmentCommand({active,available,start,stop}) {
  return {label:active?'投資停止':'投資開始',icon:active?'pause':'coins',disabled:!active&&!available,action:active?stop:start};
}
