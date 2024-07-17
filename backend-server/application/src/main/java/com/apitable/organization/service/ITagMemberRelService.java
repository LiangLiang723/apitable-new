package com.apitable.organization.service;

import com.apitable.organization.entity.TagMemberRelEntity;
import java.util.List;

/**
 * Tag Member rel.
 */
public interface ITagMemberRelService {

    List<TagMemberRelEntity> getByTagIds(List<Long> tagIds);

    List<Long> getMemberIdByTagIds(List<Long> tagIds);

    void removeMembers(Long tagId, List<Long> memberIds);

    void addMembers(Long tagId, List<Long> memberIds);

    void deleteMembersByTagId(Long tagId);

    List<Long> getTagIdsByTagMemberId(Long memberId);
}
