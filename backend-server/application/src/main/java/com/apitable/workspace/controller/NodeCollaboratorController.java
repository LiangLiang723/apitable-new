/*
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package com.apitable.workspace.controller;

import static com.apitable.organization.enums.OrganizationException.NOT_EXIST_MEMBER;

import cn.hutool.core.bean.BeanUtil;
import com.apitable.control.infrastructure.ControlTemplate;
import com.apitable.control.infrastructure.role.ControlRole;
import com.apitable.core.support.ResponseData;
import com.apitable.core.util.ExceptionUtil;
import com.apitable.organization.service.IMemberService;
import com.apitable.organization.service.IOrganizationService;
import com.apitable.organization.vo.MemberInfoVo;
import com.apitable.shared.component.scanner.annotation.ApiResource;
import com.apitable.shared.component.scanner.annotation.GetResource;
import com.apitable.shared.component.scanner.annotation.PostResource;
import com.apitable.shared.constants.ParamsConstants;
import com.apitable.shared.context.LoginContext;
import com.apitable.shared.context.SessionContext;
import com.apitable.shared.holder.SpaceHolder;
import com.apitable.shared.util.page.PageInfo;
import com.apitable.shared.util.page.PageObjectParam;
import com.apitable.space.service.ISpaceRoleService;
import com.apitable.space.service.ISpaceService;
import com.apitable.space.vo.SpaceGlobalFeature;
import com.apitable.user.service.IUserService;
import com.apitable.workspace.ro.AddNodeRoleRo;
import com.apitable.workspace.ro.BatchDeleteNodeRoleRo;
import com.apitable.workspace.ro.BatchModifyNodeRoleRo;
import com.apitable.workspace.ro.DeleteNodeRoleRo;
import com.apitable.workspace.ro.ModifyNodeRoleRo;
import com.apitable.workspace.service.INodeRoleService;
import com.apitable.workspace.service.INodeService;
import com.apitable.workspace.vo.NodeCollaboratorsVo;
import com.apitable.workspace.vo.NodeCollaboratorVO;
import com.apitable.workspace.vo.NodeRoleMemberVo;
import com.apitable.workspace.vo.NodeRoleUnit;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * Workbench - Node Role Api.
 */
@Tag(name = "Workbench - Node Role Api")
@RestController
@ApiResource(path = "/node")
public class NodeCollaboratorController {

    @Resource
    private ISpaceService iSpaceService;

    @Resource
    private IUserService iUserService;

    @Resource
    private IMemberService iMemberService;

    @Resource
    private IOrganizationService iOrganizationService;

    @Resource
    private ISpaceRoleService iSpaceRoleService;

    @Resource
    private INodeService iNodeService;

    @Resource
    private INodeRoleService iNodeRoleService;

    @Resource
    private ControlTemplate controlTemplate;

    /**
     * get node role list.
     *
     * @param nodeId node id
     * @return node role info
     */
    @GetResource(path = "/listRole")
    @Operation(summary = "Get node role list", description = "Scene: Node collaborator dialog")
    @SuppressWarnings("deprecation")
    public ResponseData<NodeCollaboratorsVo> listRole(
        @RequestParam(name = "nodeId") String nodeId,
        @RequestParam(name = "includeAdmin", required = false, defaultValue = "true") Boolean includeAdmin,
        @RequestParam(name = "includeExtend", required = false, defaultValue = "true") Boolean includeExtend,
        @RequestParam(name = "includeSelf", required = false) String includeSelf
    ) {
        String spaceId = iNodeService.getSpaceIdByNodeId(nodeId);
        SpaceHolder.set(spaceId);
        NodeCollaboratorsVo collaborators = new NodeCollaboratorsVo();
        boolean assignMode = iNodeRoleService.getNodeRoleIfEnabled(nodeId);
        String extendNodeId = assignMode ? null : iNodeRoleService.getNodeExtendNodeId(nodeId);

        collaborators.setExtend(!assignMode);
        collaborators.setBelongRootFolder(extendNodeId == null);
        collaborators.setRoleUnits(getRoleUnits(spaceId, nodeId, assignMode, extendNodeId));
        collaborators.setMembers(getRoleMembers(spaceId, nodeId, assignMode, extendNodeId));
        collaborators.setOwner(iNodeRoleService.getNodeOwner(nodeId));
        if (Boolean.TRUE.equals(includeAdmin)) {
            List<Long> admins = iSpaceRoleService.getSpaceAdminsWithWorkbenchManage(spaceId);
            collaborators.setAdmins(iOrganizationService.findAdminsVo(admins, spaceId));
        } else {
            collaborators.setAdmins(Collections.emptyList());
        }
        if (includeSelf == null || Boolean.parseBoolean(includeSelf)) {
            Long userId = SessionContext.getUserId();
            Long memberId = iMemberService.getMemberIdByUserIdAndSpaceId(userId, spaceId);
            if (memberId != null) {
                collaborators.setSelf(iOrganizationService.finUnitMemberVo(memberId));
            }
        }
        if (Boolean.TRUE.equals(includeExtend) && extendNodeId != null) {
            collaborators.setExtendNodeName(iNodeService.getNodeNameByNodeId(extendNodeId));
        }
        return ResponseData.success(collaborators);
    }

    /**
     * get node collaborators page.
     *
     * @param page page param
     * @param nodeId node id
     * @return node role member page
     */
    @GetResource(path = "/collaborator/page")
    @Operation(summary = "Get node collaborator page", description = "Scene: Node collaborator dialog")
    public ResponseData<PageInfo<NodeRoleMemberVo>> getCollaboratorPage(
        @PageObjectParam Page<NodeRoleMemberVo> page,
        @RequestParam(name = "nodeId") String nodeId
    ) {
        return ResponseData.success(iNodeRoleService.getNodeRoleMembersPageInfo(page, nodeId));
    }

    /**
     * Enable node inheritance mode.
     */
    @PostResource(path = "/enableRoleExtend")
    @Operation(summary = "Enable node role inheritance")
    public ResponseData<Void> enableRoleExtend(@RequestParam(name = "nodeId") String nodeId) {
        iNodeRoleService.disableNodeRole(SessionContext.getUserId(), nodeId);
        return ResponseData.success();
    }

    /**
     * Disable node inheritance mode.
     */
    @PostResource(path = "/disableRoleExtend")
    @Operation(summary = "Disable node role inheritance")
    public ResponseData<Void> disableRoleExtend(
        @RequestParam(name = "nodeId") String nodeId,
        @RequestBody(required = false) RoleControlOpenRoBody body
    ) {
        String spaceId = iNodeService.getSpaceIdByNodeId(nodeId);
        boolean includeExtend = body != null && Boolean.TRUE.equals(body.getIncludeExtend());
        iNodeRoleService.enableNodeRole(SessionContext.getUserId(), spaceId, nodeId, includeExtend);
        return ResponseData.success();
    }

    /**
     * add node role.
     */
    @PostResource(path = "/addRole")
    @Operation(summary = "Add node role")
    public ResponseData<Void> addRole(@RequestBody @Valid AddNodeRoleRo data) {
        iNodeRoleService.addNodeRole(SessionContext.getUserId(), data.getNodeId(), data.getRole(),
            data.getUnitIds());
        return ResponseData.success();
    }

    /**
     * edit node role.
     */
    @PostResource(path = "/editRole")
    @Operation(summary = "Edit node role")
    public ResponseData<Void> editRole(@RequestBody @Valid ModifyNodeRoleRo data) {
        iNodeRoleService.updateNodeRole(SessionContext.getUserId(), data.getNodeId(), data.getRole(),
            Collections.singletonList(data.getUnitId()));
        return ResponseData.success();
    }

    /**
     * batch edit node role.
     */
    @PostResource(path = "/batchEditRole")
    @Operation(summary = "Batch edit node role")
    public ResponseData<Void> batchEditRole(@RequestBody @Valid BatchModifyNodeRoleRo data) {
        iNodeRoleService.updateNodeRole(SessionContext.getUserId(), data.getNodeId(), data.getRole(),
            data.getUnitIds());
        return ResponseData.success();
    }

    /**
     * delete node role.
     */
    @PostResource(path = "/deleteRole", method = RequestMethod.DELETE)
    @Operation(summary = "Delete node role")
    public ResponseData<Void> deleteRole(@RequestBody @Valid DeleteNodeRoleRo data) {
        iNodeRoleService.deleteNodeRole(SessionContext.getUserId(), data.getNodeId(), data.getUnitId());
        return ResponseData.success();
    }

    /**
     * batch delete node role.
     */
    @PostResource(path = "/batchDeleteRole", method = RequestMethod.DELETE)
    @Operation(summary = "Batch delete node role")
    public ResponseData<Void> batchDeleteRole(@RequestBody @Valid BatchDeleteNodeRoleRo data) {
        data.getUnitIds().forEach(unitId ->
            iNodeRoleService.deleteNodeRole(SessionContext.getUserId(), data.getNodeId(), unitId));
        return ResponseData.success();
    }

    private List<NodeRoleUnit> getRoleUnits(String spaceId, String nodeId, boolean assignMode,
                                            String extendNodeId) {
        if (assignMode) {
            return iNodeRoleService.getNodeRoleUnitList(nodeId);
        }
        if (extendNodeId == null) {
            return Collections.singletonList(iNodeRoleService.getRootNodeRoleUnit(spaceId));
        }
        return iNodeRoleService.getNodeRoleUnitList(extendNodeId);
    }

    private List<NodeRoleMemberVo> getRoleMembers(String spaceId, String nodeId, boolean assignMode,
                                                  String extendNodeId) {
        if (assignMode) {
            return iNodeRoleService.getNodeRoleMembers(spaceId, nodeId);
        }
        if (extendNodeId == null) {
            return iNodeRoleService.getNodeRoleMembers(spaceId);
        }
        return iNodeRoleService.getNodeRoleMembers(spaceId, extendNodeId);
    }

    public static class RoleControlOpenRoBody {
        private Boolean includeExtend;

        public Boolean getIncludeExtend() {
            return includeExtend;
        }

        public void setIncludeExtend(Boolean includeExtend) {
            this.includeExtend = includeExtend;
        }
    }

    /**
     * get collaborator info.
     *
     * @param uuid   user uuid
     * @param nodeId node id
     * @return collaborator info
     */
    @GetResource(path = "/collaborator/info")
    @Operation(summary = "Get Collaborator Info",
        description = "Scene: Collaborator Card Information")
    @Parameters({
        @Parameter(name = ParamsConstants.SPACE_ID, in = ParameterIn.HEADER,
            description = "space id", required = true,
            schema = @Schema(type = "string"), example = "spcyQkKp9XJEl"),
        @Parameter(name = "nodeId", in = ParameterIn.QUERY, required = true,
            schema = @Schema(type = "string"), example = "nodRTGSy43DJ9"),
        @Parameter(name = "uuid", in = ParameterIn.QUERY, required = true,
            schema = @Schema(type = "string"), example = "1")
    })
    public ResponseData<NodeCollaboratorVO> getCollaboratorInfo(
        @RequestParam(value = "uuid") String uuid,
        @RequestParam(name = "nodeId") String nodeId
    ) {
        String spaceId = LoginContext.me().getSpaceId();
        // For member information hiding use
        SpaceGlobalFeature feature = iSpaceService.getSpaceGlobalFeature(spaceId);
        SpaceHolder.setGlobalFeature(feature);
        Long userId = iUserService.getUserIdByUuidWithCheck(uuid);
        // Get target member
        Long memberId = iMemberService.getMemberIdByUserIdAndSpaceId(userId, spaceId);
        ExceptionUtil.isNotNull(memberId, NOT_EXIST_MEMBER);
        // Get collaborator view
        MemberInfoVo member = iMemberService.getMemberInfoVo(memberId);
        NodeCollaboratorVO collaboratorVO =
            BeanUtil.copyProperties(member, NodeCollaboratorVO.class);
        ControlRole role = controlTemplate.fetchNodeRole(memberId, nodeId);
        if (role != null) {
            collaboratorVO.setRole(role.getRoleTag());
        }
        return ResponseData.success(collaboratorVO);
    }
}
