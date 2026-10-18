#include <open.mp>
#include <open_mp_ui_editor>
native UITest_Click(playerid, PlayerText:td);
native UITest_Cancel(playerid);
new UI:gUI;
new UIInstance:gInstances[2];
new gPlayers[2];
new gClicks;
new gCancels;
new gFailures;

main() {}
stock Check(bool:ok, const message[])
{
    if (!ok) {printf("UITEST FAIL: %s", message);gFailures++;}
}
public OnGameModeInit()
{
    gUI = UI_Load("login.json");
    Check(gUI != UI_INVALID, "load browser export");
    Check(UI_GetElementCount(gUI) == 8, "primitive count");
    new id[65];
    Check(UI_GetElementId(gUI, 3, id), "element lookup");
    Check(!strcmp(id, "login_button"), "stable element id");
    Check(UI_Load("../outside.json") == UI_INVALID, "path confinement");
    Check(UI_Load("malformed.json") == UI_INVALID, "malformed rejection");
    gPlayers[0] = NPC_Create("UITest_A");
    gPlayers[1] = NPC_Create("UITest_B");
    SetTimer("RunUIIntegration", 200, false);
    return 1;
}
forward RunUIIntegration();
public RunUIIntegration()
{
    for (new i; i < 2; i++)
    {
        Check(gPlayers[i] != INVALID_NPC_ID, "test NPC created");
        gInstances[i] = UI_Show(gPlayers[i], gUI);
        Check(gInstances[i] != UI_INSTANCE_INVALID, "show independent player instance");
        Check(UI_Select(gPlayers[i], gInstances[i]), "select instance");
        Check(UI_SetText(gPlayers[i], gInstances[i], "status", "Updated in native open.mp runtime."), "dynamic text");
    }
    Check(gInstances[0] != gInstances[1], "instance handles differ");
    for (new i; i < 2; i++)
    {
        new PlayerText:click = PlayerText:INVALID_TEXT_DRAW;
        for (new t; t < 256; t++)
            if (IsValidPlayerTextDraw(gPlayers[i], PlayerText:t) && PlayerTextDrawIsSelectable(gPlayers[i], PlayerText:t)) {click = PlayerText:t;break;}
        Check(click != PlayerText:INVALID_TEXT_DRAW, "native selectable primitive allocated");
        Check(bool:UITest_Click(gPlayers[i], click), "SDK click event transported");
        Check(UI_SetEnabled(gPlayers[i], gInstances[i], "login_button", false), "disable click");
        UITest_Click(gPlayers[i], click);
    }
    Check(gClicks == 2, "exact player/UI/instance/element callback dispatch; disabled click rejected");
    Check(bool:UITest_Cancel(gPlayers[1]), "SDK cancel transported");
    Check(gCancels == 1, "single cancel callback");
    Check(UI_Destroy(gPlayers[0], gInstances[0]), "destroy instance");
    NPC_Destroy(gPlayers[1]);
    Check(UI_Unload(gUI), "unload after disconnect");
    NPC_Destroy(gPlayers[0]);
    if (gFailures == 0) print("UITEST PASS: load/show/update/click/cancel/disconnect/unload");
    SendRconCommand("exit");
    return 1;
}
public OnUIClick(playerid, UI:ui, UIInstance:instance, const elementId[])
{
    Check(ui == gUI, "callback UI definition");
    Check((playerid == gPlayers[0] && instance == gInstances[0]) || (playerid == gPlayers[1] && instance == gInstances[1]), "callback player instance");
    Check(!strcmp(elementId, "login_button"), "callback element");
    Check(UI_SetColor(playerid, instance, "title", 0x80BFE0FF), "callback can safely reenter runtime");
    gClicks++;
    return 1;
}
public OnUICancel(playerid, UIInstance:instance)
{
    Check(UI_Hide(playerid, instance), "cancel callback can hide instance");
    gCancels++;
    return 1;
}
