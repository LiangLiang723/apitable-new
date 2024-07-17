package com.apitable.organization.service;

import com.apitable.organization.vo.TagInfoVo;
import java.util.List;

/**
 * Tag service.
 */
public interface ITagService {

    /**
     * create tag.
     *
     * @param groupId tag groupId , options , default 0
     * @param spaceId space Id
     * @param tagName tagName
     * @return tagId
     */
    Long createTag(Long groupId, String spaceId, String tagName);

    /**
     * update tag name.
     *
     * @param tagId   tag id
     * @param tagName tag name
     */
    void updateTagName(Long tagId, String tagName);

    /**
     * delete tag.
     *
     * @param tagId tag id
     */
    void delete(Long tagId);


    List<TagInfoVo> getTagVos(String spaceId, List<Long> tagIds);


    /**
     * get members' id in tag.
     *
     * @param tagIds the tag' id
     * @return the members' id
     */
    List<Long> getMemberIdsByTagIds(List<Long> tagIds);
}
