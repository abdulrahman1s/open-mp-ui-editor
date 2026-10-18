#include <open.mp>
#include <open_mp_ui_editor>

new UI:gLogin = UI_INVALID;
new UIInstance:gLoginInstance[MAX_PLAYERS];

main() {}

public OnGameModeInit()
{
    SetGameModeText("open.mp UI example");
    AddPlayerClass(0, 1958.3783, 1343.1572, 15.3746, 270.0, WEAPON_FIST, 0, WEAPON_FIST, 0, WEAPON_FIST, 0);
    gLogin = UI_Load("login.json");
    if (gLogin == UI_INVALID)
    {
        new error[256];
        UI_GetLastError(error);
        printf("Cannot load login.json: %s", error);
    }
    return 1;
}

public OnPlayerConnect(playerid)
{
    gLoginInstance[playerid] = UI_Show(playerid, gLogin);
    if (gLoginInstance[playerid] != UI_INSTANCE_INVALID)
        UI_Select(playerid, gLoginInstance[playerid]);
    return 1;
}

public OnUIClick(playerid, UI:ui, UIInstance:instance, const elementId[])
{
    if (ui != gLogin || instance != gLoginInstance[playerid]) return 1;
    if (!strcmp(elementId, "login_button"))
    {
        UI_SetText(playerid, instance, "status", "Sign-in button received by Pawn.");
        SendClientMessage(playerid, 0x80BFE0FF, "Connect this action to your own account system.");
    }
    else if (!strcmp(elementId, "cancel_button"))
    {
        UI_Destroy(playerid, instance);
        gLoginInstance[playerid] = UI_INSTANCE_INVALID;
    }
    return 1;
}

public OnUICancel(playerid, UIInstance:instance)
{
    UI_Hide(playerid, instance);
    return 1;
}

public OnPlayerDisconnect(playerid, reason)
{
    #pragma unused reason
    // Native resources are already cleaned up by the component.
    gLoginInstance[playerid] = UI_INSTANCE_INVALID;
    return 1;
}

public OnGameModeExit()
{
    UI_Unload(gLogin);
    return 1;
}
