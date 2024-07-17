package com.apitable.organization.mapper;

import com.apitable.organization.dto.TagInfoDto;
import com.apitable.organization.entity.TagEntity;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * tag mapper.
 */
@Mapper
public interface TagMapper extends BaseMapper<TagEntity> {

    /**
     * Update tag name.
     *
     * @param tagId tag Id
     * @param name  tag name
     */
    void updateName(@Param("tagId") Long tagId, @Param("name") String name);


    /**
     * query tag info by ids and space id.
     *
     * @param ids     the rows' id
     * @param spaceId the space's id
     * @return tag info
     */
    List<TagInfoDto> selectTagInfoDtoByIdsAndSpaceId(@Param("ids") List<Long> ids,
                                                      @Param("spaceId") String spaceId);
}
