// Engine bindings and AMX transport only. Validation, ownership and lifecycle are Rust.
#include <sdk.hpp>
#include <Server/Components/Pawn/pawn.hpp>
#include <Server/Components/TextDraws/textdraws.hpp>
#include "runtime.h"
#include <array>
#include <cstring>
#include <map>
#include <optional>
#include <string>

namespace {
ICore* core = nullptr;
IPawnComponent* pawn = nullptr;
ITextDrawsComponent* textdraws = nullptr;
bool stoppingSelection = false;
std::map<AMX*, size_t> owners;
size_t nextOwner = 0;
IPlayerTextDrawData* data(int player) {
    auto* p = core ? core->getPlayers().get(player) : nullptr;
    return p ? queryExtension<IPlayerTextDrawData>(*p) : nullptr;
}
StringView view(const RenderCommand& c) { return StringView(reinterpret_cast<const char*>(c.text), c.length); }
}
extern "C" bool ui_host_connected(int player) { return data(player) != nullptr; }
extern "C" int ui_host_create(int player, const RenderCommand* c) {
    try {
        auto* d = data(player);
        if (!d) return -1;
        auto* td = d->create(Vector2(c->x,c->y), c->kind == 0 || c->kind == 2 ? view(*c) : StringView("LD_SPAC:white"));
        return td ? td->getID() : -1;
    } catch (...) { return -1; }
}
extern "C" bool ui_host_apply(int player, int handle, const RenderCommand* c, bool shown) {
    auto* d = data(player);
    auto* td = d ? d->get(handle) : nullptr;
    if (!td) return false;
    const auto style = c->kind == 0 ? TextDrawStyle(c->font) : c->kind == 3 ? TextDrawStyle_Preview : TextDrawStyle_Sprite;
    const Vector2 size = c->kind == 0 ? Vector2(c->x+c->w,c->h) : Vector2(c->w,c->h);
    bool dirty = td->getPosition() != Vector2(c->x,c->y) || td->getStyle() != style
        || td->getTextSize() != size || td->getLetterSize() != Vector2(c->sx,c->sy)
        || td->getLetterColour().RGBA() != c->color || td->getOutline() != c->outline
        || td->isSelectable() != bool(c->selectable) || td->getShadow() != 0 || !td->isProportional()
        || td->getAlignment() != TextDrawAlignment_Left || td->hasBox()
        || (c->kind == 3 && td->getPreviewModel() != c->model);
    td->setPosition(Vector2(c->x,c->y)).setStyle(style).setTextSize(size).setLetterSize(Vector2(c->sx,c->sy))
        .setColour(Colour::FromRGBA(c->color)).setOutline(c->outline).setShadow(0).setProportional(true)
        .setAlignment(TextDrawAlignment_Left).useBox(false).setSelectable(c->selectable != 0)
        .setBackgroundColour(Colour::FromRGBA(0x000000FF));
    if (c->kind == 3) td->setPreviewModel(c->model).setPreviewRotation(Vector3(0,0,0)).setPreviewZoom(1.0f);
    const auto text = c->kind == 0 || c->kind == 2 ? view(*c) : c->kind == 3 ? StringView("_") : StringView("LD_SPAC:white");
    if (td->getText() != text) td->setText(text);
    if (shown && !td->isShown()) td->show();
    else if (!shown && td->isShown()) td->hide();
    else if (shown && dirty) td->restream();
    return true;
}
extern "C" void ui_host_destroy(int player,int handle) { if (auto* d=data(player)) d->release(handle); }
extern "C" void ui_host_select(int player,bool enabled,uint32_t color) {
    if (auto* d=data(player)) {
        stoppingSelection=true;
        if (enabled) d->beginSelection(Colour::FromRGBA(color)); else if(d->isSelecting()) d->endSelection();
        stoppingSelection=false;
    }
}

namespace {
// Validate each Pawn cell, including packed strings, before copying. No VM pointer survives a call.
std::optional<std::string> read(IPawnScript& s, cell address, size_t maximum) {
    cell* ptr=nullptr;
    if (s.GetAddr(address,&ptr) || !ptr) return {};
    const bool packed = uint32_t(*ptr) > 255;
    std::string out;
    for (size_t i=0; i<=maximum; ++i) {
        const int64_t offset=int64_t(address)+int64_t(i)*4;
        if(offset<0 || offset>INT32_MAX || s.GetAddr(cell(offset),&ptr) || !ptr) return {};
        uint32_t value=uint32_t(*ptr);
        if (!packed && value>255) return {};
        for(int j=0; j<(packed?4:1); ++j) {
            uint8_t b=packed?uint8_t(value>>(24-j*8)):uint8_t(value);
            if (!b) return out;
            if (out.size()>=maximum) return {};
            out+=char(b);
        }
    }
    return {};
}
bool write(IPawnScript& s,cell address,cell size,const char* text) {
    if(size<1 || size>1024) return false;
    cell* p=nullptr;
    const size_t count=std::min(std::strlen(text),size_t(size-1));
    // Check complete destination first, so invalid buffers produce no partial writes.
    for(size_t i=0;i<=count;++i) {
        int64_t offset=int64_t(address)+int64_t(i)*4;
        if(offset<0||offset>INT32_MAX||s.GetAddr(cell(offset),&p)||!p) return false;
    }
    for(size_t i=0;i<=count;++i) {s.GetAddr(address+cell(i*4),&p);*p=i==count?0:uint8_t(text[i]);}
    return true;
}
float number(cell v) {float f;static_assert(sizeof(f)==sizeof(v));std::memcpy(&f,&v,4);return f;}
template<int N,typename F> cell native(AMX* amx,const cell* p,F f) {
    if(!pawn||!textdraws||!p||p[0]!=N*4) return 0;
    auto it=owners.find(amx);auto* s=pawn->getScript(amx);
    if(it==owners.end()||!s) return 0;
    try {return f(*s,it->second,p+1);} catch(...) {core->printLn("[open-mp-ui] native rejected an invalid operation");return 0;}
}
int checked(int result) {
    if (!result && core) {std::array<uint8_t,1024> error{};ui_error(error.data(),error.size());core->printLn("[open-mp-ui] %s",error.data());}
    return result;
}
cell AMX_NATIVE_CALL load(AMX* a,const cell* p) {return native<1>(a,p,[](auto& s,size_t o,const cell* v){auto name=read(s,v[0],128);return name?checked(ui_load(o,reinterpret_cast<const uint8_t*>(name->data()),name->size())):0;});}
cell AMX_NATIVE_CALL unload(AMX* a,const cell* p) {return native<1>(a,p,[](auto&,size_t o,const cell* v){return checked(ui_unload(o,v[0]));});}
cell AMX_NATIVE_CALL show(AMX* a,const cell* p) {return native<2>(a,p,[](auto&,size_t o,const cell* v){return checked(ui_show(o,v[0],v[1]));});}
cell AMX_NATIVE_CALL visible(AMX* a,const cell* p) {return native<3>(a,p,[](auto&,size_t o,const cell* v){return checked(ui_visible(o,v[0],v[1],v[2]!=0));});}
cell AMX_NATIVE_CALL destroy(AMX* a,const cell* p) {return native<2>(a,p,[](auto&,size_t o,const cell* v){return checked(ui_destroy(o,v[0],v[1]));});}
cell AMX_NATIVE_CALL select(AMX* a,const cell* p) {return native<3>(a,p,[](auto&,size_t o,const cell* v){return checked(ui_select(o,v[0],v[1],uint32_t(v[2])));});}
int update(size_t o,const cell* v,const std::string& key,int property,const std::string& value,float x=0,float y=0,float w=0,float h=0) {
    return checked(ui_update(o,v[0],v[1],reinterpret_cast<const uint8_t*>(key.data()),key.size(),property,reinterpret_cast<const uint8_t*>(value.data()),value.size(),x,y,w,h));
}
cell AMX_NATIVE_CALL setText(AMX* a,const cell* p) {return native<4>(a,p,[](auto& s,size_t o,const cell* v){auto key=read(s,v[2],64),value=read(s,v[3],512);return key&&value?update(o,v,*key,0,*value):0;});}
cell AMX_NATIVE_CALL setColor(AMX* a,const cell* p) {return native<4>(a,p,[](auto& s,size_t o,const cell* v){auto key=read(s,v[2],64);char color[10];std::snprintf(color,sizeof(color),"#%08X",uint32_t(v[3]));return key?update(o,v,*key,1,color):0;});}
cell AMX_NATIVE_CALL setBounds(AMX* a,const cell* p) {return native<7>(a,p,[](auto& s,size_t o,const cell* v){auto key=read(s,v[2],64);return key?update(o,v,*key,2,"",number(v[3]),number(v[4]),number(v[5]),number(v[6])):0;});}
template<int Property> cell AMX_NATIVE_CALL setFlag(AMX* a,const cell* p) {return native<4>(a,p,[](auto& s,size_t o,const cell* v){auto key=read(s,v[2],64);return key?update(o,v,*key,Property,"",v[3]!=0):0;});}
cell AMX_NATIVE_CALL lastError(AMX* a,const cell* p) {return native<2>(a,p,[](auto& s,size_t,const cell* v){std::array<uint8_t,1024> e{};ui_error(e.data(),e.size());return int(write(s,v[0],v[1],reinterpret_cast<char*>(e.data())));});}
cell AMX_NATIVE_CALL elementId(AMX* a,const cell* p) {return native<4>(a,p,[](auto& s,size_t o,const cell* v){std::array<uint8_t,65> id{};return ui_element_id(o,v[0],v[1],id.data(),id.size())&&write(s,v[2],v[3],reinterpret_cast<char*>(id.data()))?1:0;});}
cell AMX_NATIVE_CALL elementCount(AMX* a,const cell* p) {return native<1>(a,p,[](auto&,size_t o,const cell* v){return ui_element_count(o,v[0]);});}
#ifdef UI_TEST_DRIVER
cell AMX_NATIVE_CALL testClick(AMX*,const cell*);
cell AMX_NATIVE_CALL testCancel(AMX*,const cell*);
#endif
const AMX_NATIVE_INFO natives[] = {
#ifdef UI_TEST_DRIVER
    {"UITest_Click",testClick},{"UITest_Cancel",testCancel},
#endif
    {"UI_Load",load},{"UI_Unload",unload},{"UI_Show",show},{"UI_SetVisible",visible},{"UI_Destroy",destroy},{"UI_Select",select},
    {"UI_SetText",setText},{"UI_SetColor",setColor},{"UI_SetBounds",setBounds},{"UI_SetEnabled",setFlag<3>},
    {"UI_SetElementVisible",setFlag<4>},{"UI_SetSelectable",setFlag<5>},{"UI_GetLastError",lastError},
    {"UI_GetElementId",elementId},{"UI_GetElementCount",elementCount}
};
IPawnScript* scriptFor(size_t owner) {
    if(!pawn) return nullptr;
    for(const auto& entry:owners) if(entry.second==owner) return pawn->getScript(entry.first);
    return nullptr;
}
#ifdef UI_TEST_DRIVER
class UiComponent;
UiComponent* testComponent=nullptr;
#endif
class UiComponent final : public IComponent, public PawnEventHandler, public TextDrawEventHandler, public PlayerConnectEventHandler {
public:
    PROVIDE_UID(0x4F4D505549454431);
    StringView componentName() const override {return "open-mp-ui-editor";}
    SemanticVersion componentVersion() const override {return SemanticVersion(0,1,0,0);}
    void onLoad(ICore* c) override {core=c;
#ifdef UI_TEST_DRIVER
        testComponent=this;
#endif
        core->getPlayers().getPlayerConnectDispatcher().addEventHandler(this,EventPriority_Highest);}
    void onInit(IComponentList* list) override {
        pawn=list->queryComponent<IPawnComponent>();textdraws=list->queryComponent<ITextDrawsComponent>();
        if(pawn) pawn->getEventDispatcher().addEventHandler(this);
        if(textdraws) textdraws->getEventDispatcher().addEventHandler(this,EventPriority_Highest);
        core->printLn(pawn&&textdraws?"[open-mp-ui] 0.1.0 ready (Rust runtime, native textdraws)":"[open-mp-ui] ERROR: Pawn and TextDraws components are required");
    }
    void onAmxLoad(IPawnScript& s) override {owners[s.GetAMX()]=++nextOwner;s.Register(natives,int(std::size(natives)));}
    void onAmxUnload(IPawnScript& s) override {auto it=owners.find(s.GetAMX());if(it!=owners.end()){ui_owner_unload(it->second);owners.erase(it);}}
    void onPlayerConnect(IPlayer& p) override {ui_disconnect(p.getID());}
    void onPlayerDisconnect(IPlayer& p,PeerDisconnectReason) override {ui_disconnect(p.getID());}
    void onPlayerClickPlayerTextDraw(IPlayer& p,IPlayerTextDraw& td) override {
        size_t owner;int definition,instance;std::array<uint8_t,65> id{};
        if(ui_click(p.getID(),td.getID(),&owner,&definition,&instance,id.data(),id.size()))
            if(auto* s=scriptFor(owner)) s->Call("OnUIClick",DefaultReturnValue_True,p.getID(),definition,instance,StringView(reinterpret_cast<char*>(id.data())));
    }
    bool onPlayerCancelTextDrawSelection(IPlayer& p) override {return cancel(p);}
    bool onPlayerCancelPlayerTextDrawSelection(IPlayer& p) override {return cancel(p);}
    bool cancel(IPlayer& p) {
        if(stoppingSelection) return false;
        size_t owner;int instance;
        if(!ui_cancel(p.getID(),&owner,&instance)) return false;
        if(auto* s=scriptFor(owner)) s->Call("OnUICancel",DefaultReturnValue_True,p.getID(),instance);
        return false; // Other textdraw systems still receive the engine cancellation event.
    }
    void reset() override {ui_clear();}
    void onFree(IComponent* c) override {
        if(c==textdraws){ui_clear();textdraws=nullptr;}
        if(c==pawn){ui_clear();pawn=nullptr;owners.clear();}
    }
    void free() override {
        ui_clear();
        if(pawn) pawn->getEventDispatcher().removeEventHandler(this);
        if(textdraws) textdraws->getEventDispatcher().removeEventHandler(this);
        if(core) core->getPlayers().getPlayerConnectDispatcher().removeEventHandler(this);
        core=nullptr;delete this;
    }
};
#ifdef UI_TEST_DRIVER
cell AMX_NATIVE_CALL testClick(AMX* a,const cell* p) {return native<2>(a,p,[](auto&,size_t,const cell* v){auto* d=data(v[0]);auto* td=d?d->get(v[1]):nullptr;auto* pl=core->getPlayers().get(v[0]);if(!td||!pl)return 0;testComponent->onPlayerClickPlayerTextDraw(*pl,*td);return 1;});}
cell AMX_NATIVE_CALL testCancel(AMX* a,const cell* p) {return native<1>(a,p,[](auto&,size_t,const cell* v){auto* pl=core->getPlayers().get(v[0]);if(!pl)return 0;testComponent->cancel(*pl);return 1;});}
#endif
}
COMPONENT_ENTRY_POINT() {return new UiComponent();}
