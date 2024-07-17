package com.apitable.organization.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.io.Serializable;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.Accessors;

/**
 * Tag member rel entity.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Accessors(chain = true)
@EqualsAndHashCode
@TableName(keepGlobalPrefix = true, value = "unit_tag_member_rel")
public class TagMemberRelEntity implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * Primary Key.
     */
    @TableId(value = "id", type = IdType.ASSIGN_ID)
    private Long id;


    /**
     * Tag Group ID(link#xxxx_org_tag_group#id).
     */
    private Long tagId;

    /**
     * Member ID.
     */
    private Long memberId;

    /**
     * the creator member id.
     */
    @TableField(fill = FieldFill.INSERT)
    private Long creator;

    /**
     * Create Time.
     */
    private LocalDateTime createdAt;

    /**
     * Update Time.
     */
    private LocalDateTime updatedAt;
}
