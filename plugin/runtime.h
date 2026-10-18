#pragma once
#include <cstdint>
#include <cstddef>
extern "C" {
struct RenderCommand {
    int32_t kind;
    float x,y,w,h,sx,sy;
    uint32_t color;
    int32_t font,outline,model,selectable;
    const uint8_t* text;
    size_t length;
};
int32_t ui_load(size_t,const uint8_t*,size_t);
int32_t ui_show(size_t,int32_t,int32_t);
int32_t ui_visible(size_t,int32_t,int32_t,bool);
int32_t ui_destroy(size_t,int32_t,int32_t);
int32_t ui_unload(size_t,int32_t);
int32_t ui_select(size_t,int32_t,int32_t,uint32_t);
int32_t ui_update(size_t,int32_t,int32_t,const uint8_t*,size_t,int32_t,const uint8_t*,size_t,float,float,float,float);
int32_t ui_error(uint8_t*,size_t);
int32_t ui_element_id(size_t,int32_t,int32_t,uint8_t*,size_t);
int32_t ui_element_count(size_t,int32_t);
void ui_disconnect(int32_t);
void ui_owner_unload(size_t);
void ui_clear();
bool ui_click(int32_t,int32_t,size_t*,int32_t*,int32_t*,uint8_t*,size_t);
bool ui_cancel(int32_t,size_t*,int32_t*);
}
