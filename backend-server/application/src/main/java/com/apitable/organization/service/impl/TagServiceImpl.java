package com.apitable.organization.service.impl;

import cn.hutool.core.collection.CollUtil;
import com.apitable.base.enums.DatabaseException;
import com.apitable.core.util.ExceptionUtil;
import com.apitable.organization.dto.TagInfoDto;
import com.apitable.organization.entity.TagEntity;
import com.apitable.organization.entity.TagMemberRelEntity;
import com.apitable.organization.enums.UnitType;
import com.apitable.organization.mapper.TagMapper;
import com.apitable.organization.mapper.TagMemberRelMapper;
import com.apitable.organization.service.ITagService;
import com.apitable.organization.service.IUnitService;
import com.apitable.organization.vo.TagInfoVo;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import jakarta.annotation.Resource;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Tag service.
 */
@Slf4j
@Service
public class TagServiceImpl extends ServiceImpl<TagMapper, TagEntity> implements ITagService {

    @Resource
    IUnitService iUnitService;

    @Resource
    private TagMapper tagMapper;

    @Resource
    private TagMemberRelMapper tagGroupMemberRelMapper;

    @Override
    public Long createTag(Long groupId, String spaceId, String tagName) {
        log.info("create tag: {} , spaceId: {}", tagName, spaceId);
        TagEntity tagEntity = TagEntity.builder()
            .id(IdWorker.getId())
            .spaceId(spaceId)
            .tagName(tagName)
            .build();
        boolean ret = save(tagEntity);
        ExceptionUtil.isTrue(ret, DatabaseException.INSERT_ERROR);
        // add ref unit.
        iUnitService.create(spaceId, UnitType.TAG, tagEntity.getId());
        return tagEntity.getId();
    }

    @Override
    public void updateTagName(Long tagId, String tagName) {
        tagMapper.updateName(tagId, tagName);
    }

    @Override
    public void delete(Long tagId) {
        // clear tag's member
        tagGroupMemberRelMapper.deleteMembersByTagId(tagId);
        // delete the ref unit and control role.
        iUnitService.removeByRefId(tagId);
        // delete the tag.
        boolean ret = removeById(tagId);
        ExceptionUtil.isTrue(ret, DatabaseException.DELETE_ERROR);
    }

    @Override
    public List<TagInfoVo> getTagVos(String spaceId, List<Long> tagIds) {

        if (CollUtil.isEmpty(tagIds)) {
            return CollUtil.newArrayList();
        }
        // query the space's tag.
        List<TagInfoVo> tagInfoVoList = new ArrayList<>();
        List<TagMemberRelEntity> tagMemberRelEntityList =
            tagGroupMemberRelMapper.selectByTagIds(tagIds);
        Map<Long, Long> tagCountMap = tagMemberRelEntityList.stream()
            .collect(Collectors.groupingBy(TagMemberRelEntity::getTagId, Collectors.counting()));
        List<TagInfoDto> tagInfoDtos = tagMapper.selectTagInfoDtoByIdsAndSpaceId(tagIds, spaceId);
        //calc member count
        tagInfoDtos.stream().forEach(t -> {
            Long memberCount = tagCountMap.getOrDefault(t.getId(), 0L);
            tagInfoVoList.add(TagInfoVo.builder()
                .unitId(t.getUnitId())
                .tagId(t.getId())
                .tagName(t.getTagName())
                .memberCount(memberCount)
                .build());
        });
        return tagInfoVoList;
    }

    @Override
    public List<Long> getMemberIdsByTagIds(List<Long> tagIds) {
        if (CollUtil.isEmpty(tagIds)) {
            return CollUtil.newArrayList();
        }
        List<TagMemberRelEntity> tagMemberRelEntityList =
            tagGroupMemberRelMapper.selectByTagIds(tagIds);

        return tagMemberRelEntityList.stream().map(m -> m.getMemberId()).distinct().collect(
            Collectors.toList());
    }
}
