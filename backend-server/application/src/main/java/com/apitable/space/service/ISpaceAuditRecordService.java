package com.apitable.space.service;

import com.apitable.shared.listener.event.AuditSpaceEvent.AuditSpaceArg;
import com.apitable.shared.util.page.PageInfo;
import com.apitable.space.dto.SpaceAuditDTO;
import com.apitable.space.entity.SpaceAuditRecordEntity;
import com.baomidou.mybatisplus.extension.service.IService;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Space audit record service.
 */
public interface ISpaceAuditRecordService extends IService<SpaceAuditRecordEntity> {

    /**
     * Save a space audit event.
     *
     * @param arg audit event arg
     */
    void save(AuditSpaceArg arg);

    /**
     * Query space audit records.
     *
     * @param spaceId space id
     * @param pageNo page number
     * @param pageSize page size
     * @param actions action filters
     * @param memberIds member filters
     * @param keyword keyword
     * @param beginTime begin time
     * @param endTime end time
     * @return page info
     */
    PageInfo<SpaceAuditDTO> page(String spaceId, long pageNo, long pageSize,
                                 List<String> actions, List<Long> memberIds,
                                 String keyword, LocalDateTime beginTime,
                                 LocalDateTime endTime);
}