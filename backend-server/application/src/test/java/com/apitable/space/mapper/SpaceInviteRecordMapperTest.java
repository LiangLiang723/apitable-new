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

package com.apitable.space.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.apitable.AbstractMyBatisMapperTest;
import com.apitable.space.entity.SpaceInviteRecordEntity;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.jdbc.Sql;

/**
 * @author wuyitao
 * @date 2022/4/5 1:14 AM
 */
public class SpaceInviteRecordMapperTest extends AbstractMyBatisMapperTest {

    @Autowired
    SpaceInviteRecordMapper spaceInviteRecordMapper;

    @Test
    @Sql("/sql/space-invite-record-data.sql")
    void testSelectByInviteToken() {
        SpaceInviteRecordEntity entity = spaceInviteRecordMapper.selectByInviteToken("token");
        assertThat(entity).isNotNull();
    }


    @Test
    @Sql("/sql/space-invite-record-data.sql")
    void testSelectCountBySpaceIdAndBetween() {
        // created_at 由数据库 CURRENT_TIMESTAMP 写入（容器时区），与 JVM 时区可能相差一天，
        // 用 LocalDateTime.now() 圈“今天”在跨时区/跨零点时会统计到 0 条。以记录自身的时间
        // 为基准构造区间，既保留对 BETWEEN 的验证，又与执行环境和时刻无关。
        SpaceInviteRecordEntity record = spaceInviteRecordMapper.selectByInviteToken("token");
        LocalDateTime createdAt = record.getCreatedAt();
        assertThat(createdAt).as("created_at 未被映射，无法构造查询区间").isNotNull();
        LocalDateTime startAt = createdAt.minusHours(12);
        LocalDateTime endAt = createdAt.plusHours(12);
        Integer count =
            spaceInviteRecordMapper.selectCountBySpaceIdAndBetween("spc41", startAt, endAt);
        assertThat(count).isEqualTo(1);
    }
}
