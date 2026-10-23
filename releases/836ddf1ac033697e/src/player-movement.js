export const PLAYER_WORLD_SPEED=10;
export const CAMP_UNITS_PER_WORLD_UNIT=58;
export const CAMP_PLAYER_SPEED=PLAYER_WORLD_SPEED*CAMP_UNITS_PER_WORLD_UNIT;
export function screenToWorldInput(x,y){const length=Math.hypot(21,29),a=29/length,b=21/length;return{x:x*a+y*b,y:-x*b+y*a};}
