package com.apitable.space.controller;

import cn.hutool.core.util.StrUtil;
import com.apitable.core.support.ResponseData;
import com.apitable.shared.component.scanner.annotation.ApiResource;
import com.apitable.shared.component.scanner.annotation.GetResource;
import com.apitable.shared.context.LoginContext;
import com.apitable.shared.util.page.PageInfo;
import com.apitable.space.dto.SpaceAuditDTO;
import com.apitable.space.service.ISpaceAuditRecordService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Space audit api.
 */
@RestController
@Tag(name = "Space - Audit Api")
@ApiResource(path = "/space")
public class SpaceAuditController {

    @Resource
    private ISpaceAuditRecordService iSpaceAuditRecordService;

    /**
     * Query space audit records.
     *
     * @param spaceId space id
     * @param pageNo page number
     * @param pageSize page size
     * @return audit records
     */
    @GetResource(path = "/{spaceId}/audit", requiredPermission = false)
    @Operation(summary = "Query space audit records")
    public ResponseData<PageInfo<SpaceAuditDTO>> audit(
        @PathVariable("spaceId") String spaceId,
        @RequestParam(value = "pageNo", required = false, defaultValue = "1") Long pageNo,
        @RequestParam(value = "pageSize", required = false, defaultValue = "20") Long pageSize,
        @RequestParam(value = "actions", required = false) List<String> actions,
        @RequestParam(value = "memberIds", required = false) List<Long> memberIds,
        @RequestParam(value = "keyword", required = false) String keyword,
        @RequestParam(value = "beginTime", required = false) String beginTime,
        @RequestParam(value = "endTime", required = false) String endTime
    ) {
        LoginContext.me().getUserSpaceDto(spaceId);
        PageInfo<SpaceAuditDTO> page = iSpaceAuditRecordService.page(spaceId, pageNo, pageSize,
            actions, memberIds, keyword, parseTime(beginTime), parseTime(endTime));
        return ResponseData.success(page);
    }

    private LocalDateTime parseTime(String value) {
        if (StrUtil.isBlank(value)) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException exception) {
            return null;
        }
    }
}