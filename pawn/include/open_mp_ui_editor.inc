#if defined _open_mp_ui_editor_included
    #endinput
#endif
#define _open_mp_ui_editor_included

#define UI_INVALID UI:0
#define UI_INSTANCE_INVALID UIInstance:0
#define UI_MAX_ELEMENT_ID (65)

// Files are relative to scriptfiles/ui/. Definitions and instances belong to this script.
native UI:UI_Load(const filename[]);
native bool:UI_Unload(UI:ui);
// Each call creates a separate, shown instance; selection is explicit.
native UIInstance:UI_Show(playerid, UI:ui);
native bool:UI_SetVisible(playerid, UIInstance:instance, bool:visible);
native bool:UI_Destroy(playerid, UIInstance:instance);
native bool:UI_Select(playerid, UIInstance:instance, hoverColor = 0x80BFE0FF);
native bool:UI_SetText(playerid, UIInstance:instance, const elementId[], const text[]);
native bool:UI_SetColor(playerid, UIInstance:instance, const elementId[], color);
native bool:UI_SetBounds(playerid, UIInstance:instance, const elementId[], Float:x, Float:y, Float:width, Float:height);
native bool:UI_SetEnabled(playerid, UIInstance:instance, const elementId[], bool:enabled);
native bool:UI_SetElementVisible(playerid, UIInstance:instance, const elementId[], bool:visible);
native bool:UI_SetSelectable(playerid, UIInstance:instance, const elementId[], bool:selectable);
native UI_GetElementCount(UI:ui);
native bool:UI_GetElementId(UI:ui, index, elementId[], size = sizeof elementId);
native bool:UI_GetLastError(message[], size = sizeof message);

stock bool:UI_Hide(playerid, UIInstance:instance) {return UI_SetVisible(playerid, instance, false);}
stock bool:UI_ShowInstance(playerid, UIInstance:instance) {return UI_SetVisible(playerid, instance, true);}

forward OnUIClick(playerid, UI:ui, UIInstance:instance, const elementId[]);
forward OnUICancel(playerid, UIInstance:instance);
