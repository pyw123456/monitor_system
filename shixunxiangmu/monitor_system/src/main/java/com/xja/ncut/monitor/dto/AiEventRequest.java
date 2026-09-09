package com.xja.ncut.monitor.dto;

import java.util.List;

/**
 * 模型识别服务提交的事件。形如：
 * {
 *   "image": "01_A区西门_单人闯入.png",
 *   "imagePath": "E:\\model\\ai-watch\\已检测\\01_A区西门_单人闯入.png",
 *   "objects": [{"class":"person","conf":0.94}]
 * }
 */
public class AiEventRequest {

    /** 图片文件名 */
    private String image;

    /** 识别完成后的图片绝对路径 */
    private String imagePath;

    /** 两个模型合并后的识别结果 */
    private List<AiObject> objects;

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public String getImagePath() {
        return imagePath;
    }

    public void setImagePath(String imagePath) {
        this.imagePath = imagePath;
    }

    public List<AiObject> getObjects() {
        return objects;
    }

    public void setObjects(List<AiObject> objects) {
        this.objects = objects;
    }
}
