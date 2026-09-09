package com.xja.ncut.monitor.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 告警记录，对应数据库 alarm 表。
 */
@TableName("alarm")
public class Alarm {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 告警类型/业务场景，如：人员闯入、人员聚集、烟火异常 */
    private String type;

    /** 事发区域，如：A区西门（可从图片文件名解析） */
    private String area;

    /** 级别：高 / 中 / 低 */
    private String level;

    /** 状态：待处置 / 处置中 / 已派单 / 已关闭 */
    private String status;

    /** 告警来源，如：AI视觉分析 */
    private String source;

    /** 详情描述 */
    private String detail;

    /** 检测图片文件名（位于模型服务已检测目录，可通过 /alarm-img/{name} 访问） */
    private String image;

    /** 处置人用户名（处置接口记录当前登录用户） */
    @TableField("handle_by")
    private String handleBy;

    /** 处置时间 */
    @TableField("handle_time")
    private LocalDateTime handleTime;

    @TableField("event_time")
    private LocalDateTime eventTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getArea() {
        return area;
    }

    public void setArea(String area) {
        this.area = area;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public String getHandleBy() {
        return handleBy;
    }

    public void setHandleBy(String handleBy) {
        this.handleBy = handleBy;
    }

    public LocalDateTime getHandleTime() {
        return handleTime;
    }

    public void setHandleTime(LocalDateTime handleTime) {
        this.handleTime = handleTime;
    }

    public LocalDateTime getEventTime() {
        return eventTime;
    }

    public void setEventTime(LocalDateTime eventTime) {
        this.eventTime = eventTime;
    }
}
