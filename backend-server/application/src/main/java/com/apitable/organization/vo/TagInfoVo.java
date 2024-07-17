package com.apitable.organization.vo;

import com.apitable.shared.support.serializer.NullNumberSerializer;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

/**
 * <p>
 * tag's info.
 * </p>
 */
@Data
@Builder
@Schema(description = "tag's info")
public class TagInfoVo {

    @Schema(description = "unit id", example = "1")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long unitId;

    @Schema(description = "tag id", example = "1")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long tagId;

    @Schema(description = "tag name", example = "1")
    @JsonSerialize(using = ToStringSerializer.class)
    private String tagName;

    @Schema(description = "Number of tag members", example = "3")
    @JsonSerialize(nullsUsing = NullNumberSerializer.class)
    private Long memberCount;
}
