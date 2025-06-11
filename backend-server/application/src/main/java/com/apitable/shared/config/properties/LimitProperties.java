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

package com.apitable.shared.config.properties;

import static com.apitable.shared.config.properties.LimitProperties.PREFIX_LIMIT;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;


/**
 * <p>
 * limitation properties.
 * </p>
 *
 * @author Chambers
 */
@Data
@ConfigurationProperties(prefix = PREFIX_LIMIT)
public class LimitProperties {

    public static final String PREFIX_LIMIT = "limit";

    /**
     * Maximum user space.
     */
    private Integer spaceMaxCount = -1; // No limit

    /**
     * Maximum file size of imported data table.
     */
    private Integer maxFileSize = -1; // No limit, or a very large number like 1024 * 1024 * 1024 (1GB)

    /**
     * Maximum number of columns in the number table.
     */
    private Integer maxColumnCount = -1; // No limit

    /**
     * Maximum Views.
     */
    @Deprecated
    private Integer viewMaxCount = -1; // No limit

    /**
     * Maximum number of templates.
     */
    private Integer templateMaxCount = -1; // No limit

    /**
     * Maximum loading numbers of member field in datasheet.
     */
    private Integer memberFieldMaxLoadCount = -1; // No limit

    /**
     * Maximum rows.
     */
    private Integer maxRowCount = -1; // No limit

    /**
     * limitation of attachment(byte).
     */
    @Deprecated
    private Long spaceMemoryMaxSize = -1L; // No limit

    /**
     * Maximum node number.
     */
    @Deprecated
    private Integer nodeMaxCount = -1; // No limit

    /**
     * Maximum days of recycle bin.
     */
    @Deprecated
    private Integer rubbishRetainDay = -1; // No limit (or a very large number)

    /**
     * Maximum member count of space.
     */
    @Deprecated
    private Integer memberMaxCount = -1; // No limit

    /**
     * Maximum admin number of space.
     */
    @Deprecated
    private Integer adminMaxCount = -1; // No limit

    /**
     * Maximum api usage of space.
     */
    @Deprecated
    private Integer apiUsageMaxCount = -1; // No limit

    /**
     * Maximum dashboard numbers of space.
     */
    private Integer dsbWidgetMaxCount = -1; // No limit

    /**
     * Maximum robot number of space.
     */
    private Integer dstRobotMaxCount = -1; // No limit

    /**
     * max limit of trigger count.
     */
    private Integer automationTriggerCount = -1; // No limit

    /**
     * max limit of action count.
     */
    private Integer automationActionCount = -1; // No limit

    /**
     * max invited record for a single day.
     */
    private Integer maxInviteCountForFree = -1; // No limit
}
