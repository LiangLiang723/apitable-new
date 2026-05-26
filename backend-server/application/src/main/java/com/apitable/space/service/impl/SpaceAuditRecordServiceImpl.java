package com.apitable.space.service.impl;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONUtil;
import com.apitable.organization.service.IMemberService;
import com.apitable.shared.listener.event.AuditSpaceEvent.AuditSpaceArg;
import com.apitable.shared.util.page.PageInfo;
import com.apitable.space.dto.SpaceAuditDTO;
import com.apitable.space.entity.SpaceAuditRecordEntity;
import com.apitable.space.mapper.SpaceAuditRecordMapper;
import com.apitable.space.service.ISpaceAuditRecordService;
import com.apitable.workspace.service.INodeService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import jakarta.annotation.Resource;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Space audit record service implementation.
 */
@Slf4j
@Service
public class SpaceAuditRecordServiceImpl
    extends ServiceImpl<SpaceAuditRecordMapper, SpaceAuditRecordEntity>
    implements ISpaceAuditRecordService {

    @Resource
    private INodeService iNodeService;

    @Resource
    private IMemberService iMemberService;

    @Override
    public void save(AuditSpaceArg arg) {
        if (arg == null || arg.getAction() == null) {
            return;
        }
        String spaceId = getSpaceId(arg);
        if (StrUtil.isBlank(spaceId)) {
            return;
        }
        Long memberId = null;
        String memberName = null;
        if (arg.getUserId() != null) {
            memberId = iMemberService.getMemberIdByUserIdAndSpaceId(arg.getUserId(), spaceId);
            if (memberId != null) {
                memberName = iMemberService.getMemberNameById(memberId);
            }
        }
        SpaceAuditRecordEntity entity = SpaceAuditRecordEntity.builder()
            .spaceId(spaceId)
            .memberId(memberId)
            .memberName(memberName)
            .ipAddress(arg.getRequestIp())
            .userAgent(arg.getRequestUserAgent())
            .category(arg.getAction().getCategory().name())
            .action(arg.getAction().getAction())
            .nodeId(arg.getNodeId())
            .info(arg.getInfo() == null ? null : arg.getInfo().toString())
            .build();
        boolean saved = super.save(entity);
        if (!saved) {
            log.warn("save space audit record failed, spaceId:{}, action:{}", spaceId,
                arg.getAction().getAction());
        }
    }

    @Override
    public PageInfo<SpaceAuditDTO> page(String spaceId, long pageNo, long pageSize,
                                        List<String> actions, List<Long> memberIds,
                                        String keyword, LocalDateTime beginTime,
                                        LocalDateTime endTime) {
        long safePageNo = Math.max(1, pageNo);
        long safePageSize = Math.max(1, Math.min(pageSize, 100));
        LambdaQueryWrapper<SpaceAuditRecordEntity> query = Wrappers.lambdaQuery();
        query.eq(SpaceAuditRecordEntity::getSpaceId, spaceId);
        query.in(CollUtil.isNotEmpty(actions), SpaceAuditRecordEntity::getAction, actions);
        query.in(CollUtil.isNotEmpty(memberIds), SpaceAuditRecordEntity::getMemberId, memberIds);
        query.ge(beginTime != null, SpaceAuditRecordEntity::getCreatedAt, beginTime);
        query.le(endTime != null, SpaceAuditRecordEntity::getCreatedAt, endTime);
        if (StrUtil.isNotBlank(keyword)) {
            query.and(wrapper -> wrapper.like(SpaceAuditRecordEntity::getMemberName, keyword)
                .or().like(SpaceAuditRecordEntity::getAction, keyword)
                .or().like(SpaceAuditRecordEntity::getInfo, keyword));
        }
        query.orderByDesc(SpaceAuditRecordEntity::getCreatedAt);
        Page<SpaceAuditRecordEntity> page = super.page(new Page<>(safePageNo, safePageSize), query);
        List<SpaceAuditDTO> records = page.getRecords().stream()
            .map(this::toDto)
            .collect(Collectors.toList());
        return new PageInfo<>(page.getCurrent(), page.getSize(), page.getTotal(), records);
    }

    private String getSpaceId(AuditSpaceArg arg) {
        if (StrUtil.isNotBlank(arg.getSpaceId())) {
            return arg.getSpaceId();
        }
        if (StrUtil.isBlank(arg.getNodeId())) {
            return null;
        }
        try {
            return iNodeService.getSpaceIdByNodeId(arg.getNodeId());
        } catch (Exception exception) {
            log.warn("resolve audit space id failed, nodeId:{}", arg.getNodeId(), exception);
            return null;
        }
    }

    private SpaceAuditDTO toDto(SpaceAuditRecordEntity entity) {
        SpaceAuditDTO dto = new SpaceAuditDTO();
        dto.setSpaceId(entity.getSpaceId());
        dto.setMemberId(entity.getMemberId());
        dto.setMemberName(entity.getMemberName());
        dto.setIpAddress(entity.getIpAddress());
        dto.setUserAgent(entity.getUserAgent());
        dto.setCategory(entity.getCategory());
        dto.setAction(entity.getAction());
        dto.setCreatedAt(entity.getCreatedAt());
        if (StrUtil.isNotBlank(entity.getInfo())) {
            dto.setInfo(JSONUtil.parse(entity.getInfo()));
        }
        return dto;
    }
}