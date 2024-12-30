package com.apitable.organization.service.impl;

import cn.hutool.core.collection.CollUtil;
import com.apitable.organization.entity.TagMemberRelEntity;
import com.apitable.organization.mapper.TagMemberRelMapper;
import com.apitable.organization.service.ITagMemberRelService;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import jakarta.annotation.Resource;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Tag member rel service.
 */
@Service
public class TagMemberRelServiceImpl extends ServiceImpl<TagMemberRelMapper, TagMemberRelEntity>
    implements ITagMemberRelService {

    @Resource
    private TagMemberRelMapper tagGroupMemberRelMapper;


    @Override
    public List<TagMemberRelEntity> getByTagIds(List<Long> tagIds) {
        return tagGroupMemberRelMapper.selectByTagIds(tagIds);
    }

    @Override
    public List<Long> getMemberIdByTagIds(List<Long> tagIds) {
        if (CollUtil.isEmpty(tagIds)) {
            return CollUtil.newArrayList();
        }
        return tagGroupMemberRelMapper.selectMemberIdsByTag(tagIds);
    }

    @Override
    public void removeMembers(Long tagId, List<Long> memberIds) {
        if (CollUtil.isEmpty(memberIds)) {
            return;
        }
        tagGroupMemberRelMapper.deleteByMemberIdAndTagId(tagId, memberIds);
    }

    @Override
    public void addMembers(Long tagId, List<Long> memberIds) {
        List<TagMemberRelEntity> tagMemberRelEntityList = memberIds.stream().map(m -> {
            return TagMemberRelEntity.builder()
                .id(IdWorker.getId())
                .tagId(tagId)
                .memberId(m)
                .build();
        }).collect(Collectors.toList());
        tagGroupMemberRelMapper.insertBatch(tagMemberRelEntityList);
    }

    @Override
    public void deleteMembersByTagId(Long tagId) {
        tagGroupMemberRelMapper.deleteMembersByTagId(tagId);
    }

    @Override
    public List<Long> getTagIdsByTagMemberId(Long memberId) {
        return tagGroupMemberRelMapper.selectTagIdsByMemberId(memberId);
    }

}
