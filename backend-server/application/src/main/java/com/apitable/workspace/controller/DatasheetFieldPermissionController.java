package com.apitable.workspace.controller;

import cn.hutool.core.util.StrUtil;
import com.apitable.core.support.ResponseData;
import com.apitable.organization.service.IMemberService;
import com.apitable.shared.component.scanner.annotation.ApiResource;
import com.apitable.shared.component.scanner.annotation.GetResource;
import com.apitable.shared.context.SessionContext;
import com.apitable.workspace.service.IFieldRoleService;
import com.apitable.workspace.service.INodeService;
import com.apitable.workspace.service.INodeShareSettingService;
import com.apitable.workspace.vo.FieldPermissionView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import java.util.ArrayList;
import java.util.List;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Datasheet field permission api.
 */
@RestController
@ApiResource(path = "/datasheet")
@Tag(name = "Datasheet - Field Permission Api")
public class DatasheetFieldPermissionController {

    @Resource
    private IMemberService iMemberService;

    @Resource
    private IFieldRoleService iFieldRoleService;

    @Resource
    private INodeService iNodeService;

    @Resource
    private INodeShareSettingService iNodeShareSettingService;

    /**
     * get field permission map for datasheets.
     *
     * @param dstIds datasheet ids
     * @param shareId share id
     * @return field permission views
     */
    @GetResource(path = "/field/permission", requiredLogin = false, requiredPermission = false)
    @Operation(summary = "Retrieve Datasheet Field Permission Map")
    public ResponseData<List<FieldPermissionView>> getFieldPermissionMap(
        @RequestParam("dstIds") List<String> dstIds,
        @RequestParam(value = "shareId", required = false) String shareId
    ) {
        List<String> existNodeIds = iNodeService.getExistNodeIdsBySelf(dstIds);
        if (existNodeIds.isEmpty()) {
            return ResponseData.success(new ArrayList<>());
        }
        String spaceId = iNodeService.getSpaceIdByNodeIds(existNodeIds);
        Long userId = StrUtil.isNotBlank(shareId) ? iNodeShareSettingService.getUpdatedByByShareId(shareId)
            : SessionContext.getUserId();
        Long memberId = iMemberService.getMemberIdByUserIdAndSpaceId(userId, spaceId);
        List<FieldPermissionView> views = new ArrayList<>();
        for (String nodeId : existNodeIds) {
            FieldPermissionView view = iFieldRoleService.getFieldPermissionView(memberId, nodeId, shareId);
            if (view != null) {
                views.add(view);
            }
        }
        return ResponseData.success(views);
    }
}