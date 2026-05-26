package com.apitable.workspace.controller;

import static com.apitable.shared.constants.PageConstants.PAGE_DESC;
import static com.apitable.shared.constants.PageConstants.PAGE_PARAM;
import static com.apitable.shared.constants.PageConstants.PAGE_SIMPLE_EXAMPLE;
import static com.apitable.shared.listener.enums.FieldPermissionChangeEvent.FIELD_PERMISSION_CHANGE;
import static com.apitable.shared.listener.enums.FieldPermissionChangeEvent.FIELD_PERMISSION_DISABLE;
import static com.apitable.shared.listener.enums.FieldPermissionChangeEvent.FIELD_PERMISSION_ENABLE;
import static com.apitable.shared.listener.enums.FieldPermissionChangeEvent.FIELD_PERMISSION_SETTING_CHANGE;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.BooleanUtil;
import cn.hutool.core.util.ObjectUtil;
import com.apitable.control.infrastructure.ControlIdBuilder;
import com.apitable.control.infrastructure.ControlIdBuilder.ControlId;
import com.apitable.control.infrastructure.ControlTemplate;
import com.apitable.control.infrastructure.permission.NodePermission;
import com.apitable.control.service.IControlService;
import com.apitable.core.support.ResponseData;
import com.apitable.core.util.ExceptionUtil;
import com.apitable.core.util.SpringContextHolder;
import com.apitable.organization.service.IUnitService;
import com.apitable.shared.component.scanner.annotation.ApiResource;
import com.apitable.shared.component.scanner.annotation.GetResource;
import com.apitable.shared.component.scanner.annotation.PostResource;
import com.apitable.shared.constants.ParamsConstants;
import com.apitable.shared.context.LoginContext;
import com.apitable.shared.context.SessionContext;
import com.apitable.shared.holder.MemberHolder;
import com.apitable.shared.holder.SpaceHolder;
import com.apitable.shared.listener.event.FieldPermissionEvent;
import com.apitable.shared.listener.event.FieldPermissionEvent.Arg;
import com.apitable.shared.util.page.PageInfo;
import com.apitable.shared.util.page.PageObjectParam;
import com.apitable.shared.validator.NodeMatch;
import com.apitable.workspace.enums.PermissionException;
import com.apitable.workspace.ro.BatchFieldRoleDeleteRo;
import com.apitable.workspace.ro.BatchFieldRoleEditRo;
import com.apitable.workspace.ro.FieldControlProp;
import com.apitable.workspace.ro.FieldRoleCreateRo;
import com.apitable.workspace.ro.FieldRoleDeleteRo;
import com.apitable.workspace.ro.FieldRoleEditRo;
import com.apitable.workspace.ro.RoleControlOpenRo;
import com.apitable.workspace.service.IFieldRoleService;
import com.apitable.workspace.vo.FieldCollaboratorVO;
import com.apitable.workspace.vo.FieldRoleMemberVo;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * Field Role API.
 */
@RestController
@Tag(name = "Workbench - Field Role API")
@ApiResource
@Validated
public class FieldRoleController {

    @Resource
    private IFieldRoleService iFieldRoleService;

    @Resource
    private IControlService iControlService;

    @Resource
    private ControlTemplate controlTemplate;

    @Resource
    private IUnitService iUnitService;

    /**
     * Enable field role.
     */
    @PostResource(path = "/datasheet/{dstId}/field/{fieldId}/permission/enable",
        requiredPermission = false)
    @Operation(summary = "Enable field role")
    @Parameters({
        @Parameter(name = "dstId", description = "datasheet id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstCgcfixAKyee"),
        @Parameter(name = "fieldId", description = "field id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldRg1cGlAFWG")
    })
    public ResponseData<Void> enableRole(@PathVariable("dstId") @NodeMatch String dstId,
                                         @PathVariable("fieldId") String fieldId,
                                         @RequestBody(required = false)
                                         RoleControlOpenRo roleControlOpenRo) {
        iFieldRoleService.checkFieldPermissionBeforeEnable(dstId, fieldId);
        controlTemplate.checkNodePermission(MemberHolder.get(), dstId, NodePermission.MANAGE_NODE,
            status -> ExceptionUtil.isTrue(status, PermissionException.NODE_OPERATION_DENIED));
        ControlId controlId = ControlIdBuilder.fieldId(dstId, fieldId);
        iControlService.checkControlStatus(controlId.toString(),
            status -> ExceptionUtil.isFalse(status,
                PermissionException.FIELD_PERMISSION_HAS_ENABLE));
        boolean includeExtend = ObjectUtil.isNotNull(roleControlOpenRo)
            && BooleanUtil.isTrue(roleControlOpenRo.getIncludeExtend());
        iFieldRoleService.enableFieldRole(SessionContext.getUserId(), dstId, fieldId,
            includeExtend);
        Arg arg = Arg.builder().event(FIELD_PERMISSION_ENABLE).datasheetId(dstId).fieldId(fieldId)
            .uuid(LoginContext.me().getLoginUser().getUuid()).includeExtend(includeExtend)
            .operator(LoginContext.me().getUserSpaceDto(SpaceHolder.get()).getMemberName()).build();
        SpringContextHolder.getApplicationContext()
            .publishEvent(new FieldPermissionEvent(this, arg));
        return ResponseData.success();
    }

    /**
     * Disable field role.
     */
    @PostResource(path = "/datasheet/{dstId}/field/{fieldId}/permission/disable",
        requiredPermission = false)
    @Operation(summary = "Disable field role")
    @Parameters({
        @Parameter(name = "dstId", description = "datasheet id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstCgcfixAKyeeNP"),
        @Parameter(name = "fieldId", description = "field id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldRg1cGlAFWG")
    })
    public ResponseData<Void> disableRole(@PathVariable("dstId") @NodeMatch String dstId,
                                          @PathVariable("fieldId") String fieldId) {
        ControlId controlId = ControlIdBuilder.fieldId(dstId, fieldId);
        iFieldRoleService.checkFieldHasOperation(controlId.toString(), MemberHolder.get());
        iControlService.removeControl(SessionContext.getUserId(), controlId.getControlIds(), true);
        Arg arg = Arg.builder().event(FIELD_PERMISSION_DISABLE).datasheetId(dstId).fieldId(fieldId)
            .operator(LoginContext.me().getUserSpaceDto(SpaceHolder.get()).getMemberName()).build();
        SpringContextHolder.getApplicationContext()
            .publishEvent(new FieldPermissionEvent(this, arg));
        return ResponseData.success();
    }

    /**
     * Page query field collaborators.
     */
    @GetResource(path = "/datasheet/{dstId}/field/{fieldId}/collaborator/page")
    @Operation(summary = "Page Query the Field' Collaborator", description = PAGE_DESC)
    @Parameters({
        @Parameter(name = ParamsConstants.SPACE_ID, description = "space id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.HEADER, example = "spcyQkKp9XJEl"),
        @Parameter(name = "dstId", description = "datasheet id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstCgcfixAKyeeNs"),
        @Parameter(name = "fieldId", description = "field id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldRg1cGlAFWG"),
        @Parameter(name = PAGE_PARAM, description = "page's parameter", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.QUERY,
            example = PAGE_SIMPLE_EXAMPLE)
    })
    public ResponseData<PageInfo<FieldRoleMemberVo>> getCollaboratorPage(
        @PathVariable("dstId") @NodeMatch String dstId,
        @PathVariable("fieldId") String fieldId,
        @PageObjectParam Page<FieldRoleMemberVo> page
    ) {
        Long memberId = LoginContext.me().getMemberId();
        controlTemplate.checkNodePermission(memberId, dstId, NodePermission.READ_NODE,
            status -> ExceptionUtil.isTrue(status, PermissionException.NODE_ACCESS_DENIED));
        PageInfo<FieldRoleMemberVo> pageInfo =
            iFieldRoleService.getFieldRoleMembersPageInfo(page, dstId, fieldId);
        return ResponseData.success(pageInfo);
    }

    /**
     * Gets the field role infos in datasheet.
     */
    @GetResource(path = "/datasheet/{dstId}/field/{fieldId}/listRole", requiredPermission = false)
    @Operation(summary = "Gets the field role infos in datasheet.")
    @Parameters({
        @Parameter(name = "dstId", description = "datasheet id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstCgcfixAKyeeNs"),
        @Parameter(name = "fieldId", description = "field id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldRg1cGlAFWG")
    })
    public ResponseData<FieldCollaboratorVO> listRole(
        @PathVariable("dstId") @NodeMatch String dstId,
        @PathVariable("fieldId") String fieldId) {
        FieldCollaboratorVO fieldCollaboratorVO = iFieldRoleService.getFieldRoles(dstId, fieldId);
        return ResponseData.success(fieldCollaboratorVO);
    }

    /**
     * Add field role.
     */
    @PostResource(path = "/datasheet/{dstId}/field/{fieldId}/addRole", requiredPermission = false)
    @Operation(summary = "Add field role")
    @Parameters({
        @Parameter(name = "dstId", description = "datasheet id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "dstCgcfixAKyeeN"),
        @Parameter(name = "fieldId", description = "field id", required = true,
            schema = @Schema(type = "string"), in = ParameterIn.PATH, example = "fldRg1cGlAFWG")
    })
    public ResponseData<Void> addRole(@PathVariable("dstId") @NodeMatch String dstId,
                                      @PathVariable("fieldId") String fieldId,
                                      @Valid @RequestBody FieldRoleCreateRo data) {
        ControlId controlId = ControlIdBuilder.fieldId(dstId, fieldId);
        iFieldRoleService.checkFieldHasOperation(controlId.toString(), MemberHolder.get());
        iUnitService.checkInSpace(SpaceHolder.get(), data.getUnitIds());
        iFieldRoleService.addFieldRole(SessionContext.getUserId(), controlId.toString(),
            data.getUnitIds(), data.getRole());
        Arg arg = Arg.builder().event(FIELD_PERMISSION_CHANGE).datasheetId(dstId).fieldId(fieldId)
            .role(data.getRole()).changedUnitIds(data.getUnitIds())
            .operator(LoginContext.me().getUserSpaceDto(SpaceHolder.get()).getMemberName()).build();
        SpringContextHolder.getApplicationContext()
            .publishEvent(new FieldPermissionEvent(this, arg));
        return ResponseData.success();
    }

    /**
     * Edit field role.
     */
    @Deprecated
    @PostResource(path = "/datasheet/{dstId}/field/{fieldId}/editRole", requiredPermission = false)
    @Operation(summary = "Edit field role")
    public ResponseData<Void> editRole(@PathVariable("dstId") @NodeMatch String dstId,
                                       @PathVariable("fieldId") String fieldId,
                                       @RequestBody @Valid FieldRoleEditRo data) {
        BatchFieldRoleEditRo ro = new BatchFieldRoleEditRo();
        ro.setUnitIds(CollUtil.newArrayList(data.getUnitId()));
        ro.setRole(data.getRole());
        return batchEditRole(dstId, fieldId, ro);
    }

    /**
     * Batch edit field role.
     */
    @PostResource(path = "/datasheet/{dstId}/field/{fieldId}/batchEditRole",
        requiredPermission = false)
    @Operation(summary = "Batch edit field role")
    public ResponseData<Void> batchEditRole(@PathVariable("dstId") @NodeMatch String dstId,
                                            @PathVariable("fieldId") String fieldId,
                                            @RequestBody @Valid BatchFieldRoleEditRo data) {
        ControlId controlId = ControlIdBuilder.fieldId(dstId, fieldId);
        iFieldRoleService.checkFieldHasOperation(controlId.toString(), MemberHolder.get());
        iUnitService.checkInSpace(SpaceHolder.get(), data.getUnitIds());
        iFieldRoleService.editFieldRole(SessionContext.getUserId(), controlId.toString(),
            data.getUnitIds(), data.getRole());
        Arg arg = Arg.builder().event(FIELD_PERMISSION_CHANGE).datasheetId(dstId).fieldId(fieldId)
            .role(data.getRole()).changedUnitIds(data.getUnitIds())
            .operator(LoginContext.me().getUserSpaceDto(SpaceHolder.get()).getMemberName()).build();
        SpringContextHolder.getApplicationContext()
            .publishEvent(new FieldPermissionEvent(this, arg));
        return ResponseData.success();
    }

    /**
     * Delete field role.
     */
    @PostResource(path = "/datasheet/{dstId}/field/{fieldId}/deleteRole",
        method = RequestMethod.DELETE, requiredPermission = false)
    @Operation(summary = "Delete field role")
    public ResponseData<Void> deleteRole(@PathVariable("dstId") @NodeMatch String dstId,
                                         @PathVariable("fieldId") String fieldId,
                                         @RequestBody @Valid FieldRoleDeleteRo data) {
        ControlId controlId = ControlIdBuilder.fieldId(dstId, fieldId);
        iFieldRoleService.checkFieldHasOperation(controlId.toString(), MemberHolder.get());
        iUnitService.checkInSpace(SpaceHolder.get(), Collections.singletonList(data.getUnitId()));
        String role =
            iFieldRoleService.deleteFieldRole(controlId.toString(), dstId, data.getUnitId());
        Arg arg = Arg.builder().event(FIELD_PERMISSION_CHANGE).datasheetId(dstId).fieldId(fieldId)
            .delUnitIds(CollUtil.newArrayList(data.getUnitId()))
            .role(role)
            .operator(LoginContext.me().getUserSpaceDto(SpaceHolder.get()).getMemberName()).build();
        SpringContextHolder.getApplicationContext()
            .publishEvent(new FieldPermissionEvent(this, arg));
        return ResponseData.success();
    }

    /**
     * Batch delete role.
     */
    @PostResource(path = "/datasheet/{dstId}/field/{fieldId}/batchDeleteRole",
        method = RequestMethod.DELETE, requiredPermission = false)
    @Operation(summary = "Batch delete role")
    public ResponseData<Void> batchDeleteRole(@PathVariable("dstId") @NodeMatch String dstId,
                                              @PathVariable("fieldId") String fieldId,
                                              @RequestBody @Valid BatchFieldRoleDeleteRo data) {
        ControlId controlId = ControlIdBuilder.fieldId(dstId, fieldId);
        iFieldRoleService.checkFieldHasOperation(controlId.toString(), MemberHolder.get());
        iUnitService.checkInSpace(SpaceHolder.get(), data.getUnitIds());
        Map<String, List<Long>> roleToUnitIds =
            iFieldRoleService.deleteFieldRoles(controlId.toString(), data.getUnitIds());
        roleToUnitIds.forEach((role, unitIds) -> {
            Arg arg =
                Arg.builder().event(FIELD_PERMISSION_CHANGE).datasheetId(dstId).fieldId(fieldId)
                    .delUnitIds(unitIds)
                    .operator(LoginContext.me().getUserSpaceDto(SpaceHolder.get()).getMemberName())
                    .build();
            SpringContextHolder.getApplicationContext()
                .publishEvent(new FieldPermissionEvent(this, arg));
        });
        return ResponseData.success();
    }

    /**
     * Update field role setting.
     */
    @PostResource(path = "/datasheet/{dstId}/field/{fieldId}/updateRoleSetting",
        requiredPermission = false)
    @Operation(summary = "Update field role setting")
    public ResponseData<Void> updateRoleSetting(@PathVariable("dstId") @NodeMatch String dstId,
                                                @PathVariable("fieldId") String fieldId,
                                                @RequestBody @Valid FieldControlProp prop) {
        ControlId controlId = ControlIdBuilder.fieldId(dstId, fieldId);
        iFieldRoleService.checkFieldHasOperation(controlId.toString(), MemberHolder.get());
        iFieldRoleService.updateFieldRoleProp(SessionContext.getUserId(), controlId.toString(),
            prop);
        Arg arg =
            Arg.builder().event(FIELD_PERMISSION_SETTING_CHANGE).datasheetId(dstId).fieldId(fieldId)
                .setting(prop)
                .operator(LoginContext.me().getUserSpaceDto(SpaceHolder.get()).getMemberName())
                .build();
        SpringContextHolder.getApplicationContext()
            .publishEvent(new FieldPermissionEvent(this, arg));
        return ResponseData.success();
    }
}