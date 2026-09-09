package com.xja.ncut.monitor.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 单个识别目标。JSON 形如 {"class":"person","conf":0.94}。
 * 字段名 class 与 Java 关键字风格不同，通过 @JsonProperty 映射。
 */
public class AiObject {

    @JsonProperty("class")
    private String cls;

    private Double conf;

    @JsonProperty("class")
    public String getCls() {
        return cls;
    }

    @JsonProperty("class")
    public void setCls(String cls) {
        this.cls = cls;
    }

    public Double getConf() {
        return conf;
    }

    public void setConf(Double conf) {
        this.conf = conf;
    }
}
