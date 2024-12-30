package com.apitable.organization.mapper;

import com.apitable.organization.entity.TagMemberRelEntity;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import java.util.Collection;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * tag group member rel mapper.
 */
@Mapper
public interface TagMemberRelMapper extends BaseMapper<TagMemberRelEntity> {

    /**
     * insert batch.
     *
     * @param entities tag-group-member-ref
     * @return affected rows
     */
    int insertBatch(@Param("entities") List<TagMemberRelEntity> entities);

    /**
     * query tag members by tagIds.
     *
     * @param tagIds tag ids
     * @return tag-group-member-ref
     */
    List<TagMemberRelEntity> selectByTagIds(@Param("tagIds") List<Long> tagIds);

    /**
     * query member-ids by tagId.
     *
     * @param tagIds tag ids
     * @return member ids
     */
    List<Long> selectMemberIdsByTag(@Param("tagIds") List<Long> tagIds);

    /**
     * delete by member id.
     *
     * @param memberIds member ids
     * @return affected rows
     */
    int deleteByMemberIdAndTagId(@Param("tagId") Long tagId,
                                 @Param("memberIds") List<Long> memberIds);

    /**
     * delete by tag id.
     *
     * @param tagId tag id
     * @return affected rows
     */
    int deleteMembersByTagId(@Param("tagId") Long tagId);

    /**
     * delete bulk with tag group ids.
     *
     * @param tagIds tag ids
     * @return affected rows
     */
    int deleteByTagIds(@Param("tagIds") Collection<Long> tagIds);


    /**
     * get tag' id by role member id.
     *
     * @param memberId the tag member's id
     * @return the tag' id of the member's ref.
     */
    List<Long> selectTagIdsByMemberId(@Param("memberId") Long memberId);

}
