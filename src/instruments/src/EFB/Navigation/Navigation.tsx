/* eslint-disable max-len,react/no-this-in-sfc,no-console */
import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowClockwise,
    ArrowCounterclockwise,
    ArrowsExpand,
    ArrowsFullscreen,
    Dash,
    FullscreenExit,
    MoonFill,
    Plus,
    SunFill,
    XCircleFill,
} from 'react-bootstrap-icons';
import { useSimVar } from '@instruments/common/simVars';
import { ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { t } from '../translation';
import { TooltipWrapper } from '../UtilComponents/TooltipWrapper';
// import { DrawableCanvas } from '../UtilComponents/DrawableCanvas';
import { useNavigraph } from '../ChartsApi/Navigraph';
import { SimpleInput } from '../UtilComponents/Form/SimpleInput/SimpleInput';
import { useAppDispatch, useAppSelector } from '../Store/store';
import {
    ChartProvider,
    editTabProperty,
    NavigationTab,
    ProviderTab,
    setBoundingBox,
    setProvider,
    setSelectedNavigationTabIndex,
    setUsingDarkTheme,
} from '../Store/features/navigationPage';
import { PageLink, PageRedirect, TabRoutes } from '../Utils/routing';
import { Navbar } from '../UtilComponents/Navbar';
import { NavigraphPage } from './Pages/NavigraphPage/NavigraphPage';
import { getPdfUrl, LocalFilesPage } from './Pages/LocalFilesPage/LocalFilesPage';
import { PinnedChartUI } from './Pages/PinnedChartsPage';

export const navigationTabs: (PageLink & {associatedTab: NavigationTab})[] = [
    { name: 'Navigraph', alias: '', component: <NavigraphPage />, associatedTab: NavigationTab.NAVIGRAPH },
    { name: 'Local Files', alias: '', component: <LocalFilesPage />, associatedTab: NavigationTab.LOCAL_FILES },
    { name: 'Pinned Charts', alias: '', component: <PinnedChartUI />, associatedTab: NavigationTab.PINNED_CHARTS },
];

export const Navigation = () => {
    const dispatch = useAppDispatch();

    if (navigationTabs) {
        navigationTabs[0].alias = t('NavigationAndCharts.Navigraph.Title');
        navigationTabs[1].alias = t('NavigationAndCharts.LocalFiles.Title');
        navigationTabs[2].alias = t('NavigationAndCharts.PinnedCharts.Title');
    }

    return (
        <div className="w-full h-full">
            <div className="relative">
                <h1 className="font-bold">{t('NavigationAndCharts.Title')}</h1>
                <Navbar
                    className="absolute top-0 right-0"
                    tabs={navigationTabs}
                    basePath="/navigation"
                    onSelected={(index) => {
                        const associatedTab = ChartProvider[navigationTabs[index].associatedTab];
                        dispatch(setSelectedNavigationTabIndex(index));
                        dispatch(setBoundingBox(undefined));
                        dispatch(setProvider(associatedTab));
                    }}
                />
            </div>

            <div className="mt-4">
                <PageRedirect basePath="/navigation" tabs={navigationTabs} />
                <TabRoutes basePath="/navigation" tabs={navigationTabs} />
            </div>
        </div>
    );
};

export const ChartViewer = () => {
    const dispatch = useAppDispatch();
    const {
        selectedNavigationTabIndex,
        usingDarkTheme,
        planeInFocus,
        boundingBox,
        provider,
    } = useAppSelector((state) => state.navigationTab);

    const currentTab = navigationTabs[selectedNavigationTabIndex].associatedTab as ProviderTab;
    const {
        isFullScreen,
        chartDimensions,
        chartLinks,
        chartId,
        pagesViewable,
        currentPage,
        chartPosition,
        chartRotation,
    } = useAppSelector((state) => state.navigationTab[currentTab]);

    // const [drawMode] = useState(false);
    // const [brushSize] = useState(10);

    const { userName } = useNavigraph();

    const ref = useRef<HTMLDivElement>(null);
    const chartRef = useRef<HTMLDivElement>(null);

    const [aircraftIconVisible, setAircraftIconVisible] = useState(false);
    const [aircraftIconPosition, setAircraftIconPosition] = useState<{ x: number, y: number, r: number }>({ x: 0, y: 0, r: 0 });
    const [aircraftLatitude] = useSimVar('PLANE LATITUDE', 'degree latitude', 1000);
    const [aircraftLongitude] = useSimVar('PLANE LONGITUDE', 'degree longitude', 1000);
    const [aircraftTrueHeading] = useSimVar('PLANE HEADING DEGREES TRUE', 'degrees', 100);

    useEffect(() => {
        let visible = false;

        if (boundingBox
            && aircraftLatitude >= boundingBox.bottomLeft.lat
            && aircraftLatitude <= boundingBox.topRight.lat
            && aircraftLongitude >= boundingBox.bottomLeft.lon
            && aircraftLongitude <= boundingBox.topRight.lon) {
            const dx = boundingBox.topRight.xPx - boundingBox.bottomLeft.xPx;
            const dy = boundingBox.bottomLeft.yPx - boundingBox.topRight.yPx;
            const dLat = boundingBox.topRight.lat - boundingBox.bottomLeft.lat;
            const dLon = boundingBox.topRight.lon - boundingBox.bottomLeft.lon;
            const x = boundingBox.bottomLeft.xPx + dx * ((aircraftLongitude - boundingBox.bottomLeft.lon) / dLon);
            const y = boundingBox.topRight.yPx + dy * ((boundingBox.topRight.lat - aircraftLatitude) / dLat);

            setAircraftIconPosition({ x, y, r: aircraftTrueHeading });
            visible = true;
        }

        setAircraftIconVisible(visible);
    }, [boundingBox, chartLinks, aircraftLatitude.toFixed(2), aircraftLongitude.toFixed(2), aircraftTrueHeading.toFixed(1)]);

    const handleRotateRight = () => {
        dispatch(editTabProperty({ tab: currentTab, chartRotation: (chartRotation + 90) % 360 }));
    };

    const handleRotateLeft = () => {
        dispatch(editTabProperty({ tab: currentTab, chartRotation: (chartRotation - 90) % 360 }));
    };

    useEffect(() => {
        const img = new Image();
        // eslint-disable-next-line func-names
        img.onload = function () {
            if (ref.current) {
                // @ts-ignore
                const imgWidth = this.width;
                // @ts-ignore
                const imgHeight = this.height;
                const chartDimensions: { width: number, height: number } = {
                    width: -1,
                    height: -1,
                };

                if (imgWidth > imgHeight) { // landscape
                    chartDimensions.height = ref.current.clientHeight;
                    chartDimensions.width = imgWidth * (ref.current.clientHeight / imgHeight);
                } else { // portrait
                    chartDimensions.height = imgHeight * (ref.current.clientWidth / imgWidth);
                    chartDimensions.width = ref.current.clientWidth;
                }

                dispatch(editTabProperty({
                    tab: currentTab,
                    chartDimensions,
                }));
            }
        };
        img.src = chartLinks.light;
    }, [chartLinks, currentPage]);

    useEffect(() => {
        const { width, height } = chartDimensions;
        if (chartRef.current && width && height) {
            if (width > height) {
                chartRef.current.style.width = `${width}px`;
                chartRef.current.style.height = `${height}px`;
            }
            if (height > width) {
                chartRef.current.style.width = `${width}px`;
                chartRef.current.style.height = `${height}px`;
            }
        }
    }, [chartRef, chartDimensions]);

    useEffect(() => {
        if (pagesViewable > 1) {
            getPdfUrl(chartId, currentPage)
                .then((url) => {
                    dispatch(editTabProperty({ tab: currentTab, chartName: { light: url, dark: url } }));
                })
                .catch((error) => {
                    console.error(`Error: ${error}`);
                });
        }
    }, [currentPage]);

    const transformRef = useRef<ReactZoomPanPinchRef>(null);
    const planeRef = useRef(null);

    if (!chartLinks.light || !chartLinks.dark) {
        return (
            <div
                className={`flex relative items-center justify-center bg-theme-accent rounded-lg ${!isFullScreen && 'rounded-l-none ml-6'}`}
                style={{ width: `${isFullScreen ? '1278px' : '804px'}` }}
            >
                {isFullScreen && (
                    <div
                        className="flex absolute top-6 right-6 flex-row items-center p-4 hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight rounded-md transition duration-100"
                        onClick={() => dispatch(editTabProperty({ tab: currentTab, isFullScreen: false }))}
                    >
                        <FullscreenExit size={40} />
                        <p className="ml-4 text-current">{t('NavigationAndCharts.ExitFullscreenMode')}</p>
                    </div>
                )}
                <p>{t('NavigationAndCharts.ThereIsNoChartToDisplay')}</p>
            </div>
        );
    }

    // noinspection PointlessBooleanExpressionJS
    return (
        <div
            className={`relative ${!isFullScreen && 'rounded-l-none ml-6'}`}
            style={{ width: `${isFullScreen ? '1278px' : '804px'}` }}
        >
            <TransformWrapper
                ref={transformRef}
                initialScale={chartPosition.scale}
                initialPositionX={chartPosition.positionX}
                initialPositionY={chartPosition.positionY}
                velocityAnimation={{
                    disabled: true,
                    sensitivity: 0,
                }}
                minScale={0.05}
                maxScale={5}
                limitToBounds={false}
            >
                {({ zoomIn, zoomOut, setTransform, state }) => (
                    <div
                        className="h-full"
                        onMouseUp={() => dispatch(editTabProperty({ tab: currentTab, chartPosition: { ...state } }))}
                    >
                        {pagesViewable > 1 && (
                            <div className="flex overflow-hidden absolute top-6 left-6 z-40 flex-row items-center rounded-md">
                                <div
                                    className={`flex flex-row justify-center items-center h-14 bg-opacity-40 transition duration-100 cursor-pointer hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight ${currentPage === 1 && 'opacity-50 pointer-events-none'}`}
                                    onClick={() => dispatch(editTabProperty({ tab: currentTab, currentPage: currentPage - 1 }))}
                                >
                                    <Dash size={40} />
                                </div>
                                <SimpleInput
                                    min={1}
                                    max={pagesViewable}
                                    value={currentPage}
                                    number
                                    onBlur={(value) => {
                                        dispatch(editTabProperty({
                                            tab: currentTab,
                                            currentPage: value ? Number.parseInt(value) : 1,
                                        }));
                                    }}
                                    className="w-16 h-14 rounded-r-none rounded-l-none border-transparent"
                                />
                                <div className="flex flex-shrink-0 items-center px-2 h-14 bg-theme-secondary">
                                    {`of ${pagesViewable}`}
                                </div>
                                <div
                                    className={`flex flex-row justify-center items-center h-14 bg-opacity-40 transition duration-100 cursor-pointer hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight ${currentPage === pagesViewable && 'opacity-50 pointer-events-none'}`}
                                    onClick={() => dispatch(editTabProperty({ tab: currentTab, currentPage: currentPage + 1 }))}
                                >
                                    <Plus size={40} />
                                </div>
                            </div>
                        )}

                        <div className="flex overflow-hidden absolute top-6 right-6 bottom-6 z-30 flex-col justify-between rounded-md cursor-pointer">
                            <div className="flex overflow-hidden flex-col rounded-md">
                                <TooltipWrapper text={t('NavigationAndCharts.TT.RotateLeft45Degrees')}>
                                    <button
                                        type="button"
                                        onClick={handleRotateLeft}
                                        className={`p-2 transition hover:text-theme-body duration-100 cursor-pointer bg-theme-secondary hover:bg-theme-highlight ${planeInFocus && 'text-theme-unselected pointer-events-none'}`}
                                    >
                                        <ArrowCounterclockwise size={40} />
                                    </button>
                                </TooltipWrapper>
                                <TooltipWrapper text={t('NavigationAndCharts.TT.RotateRight45Degrees')}>
                                    <button
                                        type="button"
                                        onClick={handleRotateRight}
                                        className={`p-2 transition hover:text-theme-body duration-100 cursor-pointer bg-theme-secondary hover:bg-theme-highlight ${planeInFocus && 'text-theme-unselected pointer-events-none'}`}
                                    >
                                        <ArrowClockwise className="fill-current" size={40} />
                                    </button>
                                </TooltipWrapper>
                            </div>
                            <div className="flex overflow-hidden flex-col rounded-md">
                                <TooltipWrapper text={t('NavigationAndCharts.TT.FitChartToHeight')}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (ref.current && chartRef.current) {
                                                const rotated90degree = Math.abs(chartRotation) === 90 || Math.abs(chartRotation) === 270;
                                                let newScale: number;
                                                let offsetX = 0;
                                                let offsetY = 0;

                                                if (chartRef.current.clientHeight >= chartRef.current.clientWidth) { // portrait
                                                    if (rotated90degree) {
                                                        newScale = ref.current.clientHeight / chartRef.current.clientWidth;
                                                        offsetX = (ref.current.clientWidth - ref.current.clientHeight) / 2;
                                                        offsetY = ((chartRef.current.clientWidth - chartRef.current.clientHeight) / 2) * newScale;
                                                    } else {
                                                        newScale = ref.current.clientHeight / chartRef.current.clientHeight;
                                                        offsetX = (ref.current.clientWidth - (chartRef.current.clientWidth * newScale)) / 2;
                                                    }
                                                } else { // landscape
                                                    // eslint-disable-next-line no-lonely-if
                                                    if (rotated90degree) {
                                                        newScale = ref.current.clientHeight / chartRef.current.clientWidth;
                                                        offsetY = ((chartRef.current.clientWidth - chartRef.current.clientHeight) / 2) * newScale;
                                                    } else {
                                                        newScale = ref.current.clientHeight / chartRef.current.clientHeight;
                                                        offsetX = (ref.current.clientWidth - (chartRef.current.clientWidth * newScale)) / 2;
                                                    }
                                                }

                                                setTransform(offsetX, offsetY, newScale);
                                                dispatch(editTabProperty({
                                                    tab: currentTab,
                                                    chartPosition: {
                                                        positionX: offsetX,
                                                        positionY: offsetY,
                                                        scale: newScale,
                                                    },
                                                }));
                                            }
                                        }}
                                        className="p-2 hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight transition duration-100 cursor-pointer"
                                    >
                                        <ArrowsExpand size={40} />
                                    </button>
                                </TooltipWrapper>

                                <TooltipWrapper text={t('NavigationAndCharts.TT.FitChartToWidth')}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (ref.current && chartRef.current) {
                                                const rotated90degree = Math.abs(chartRotation) === 90 || Math.abs(chartRotation) === 270;
                                                let newScale: number;
                                                let offsetX = 0;
                                                let offsetY = 0;

                                                if (chartRef.current.clientHeight >= chartRef.current.clientWidth) { // portrait
                                                    if (rotated90degree) {
                                                        newScale = ref.current.clientWidth / chartRef.current.clientHeight;
                                                        offsetX = ((chartRef.current.clientHeight - chartRef.current.clientWidth) / 2) * newScale;
                                                        offsetY = (ref.current.clientHeight - ref.current.clientWidth) / 2;
                                                    } else {
                                                        newScale = ref.current.clientWidth / chartRef.current.clientWidth;
                                                        offsetY = (ref.current.clientHeight - (chartRef.current.clientHeight * newScale)) / 2;
                                                    }
                                                } else { // landscape
                                                    // eslint-disable-next-line no-lonely-if
                                                    if (rotated90degree) {
                                                        newScale = ref.current.clientWidth / chartRef.current.clientHeight;
                                                        offsetX = ((chartRef.current.clientHeight - chartRef.current.clientWidth) / 2) * newScale;
                                                    } else {
                                                        newScale = ref.current.clientWidth / chartRef.current.clientWidth;
                                                        offsetY = (ref.current.clientHeight - (chartRef.current.clientHeight * newScale)) / 2;
                                                    }
                                                }

                                                setTransform(offsetX, offsetY, newScale);
                                                dispatch(editTabProperty({
                                                    tab: currentTab,
                                                    chartPosition: {
                                                        positionX: offsetX,
                                                        positionY: offsetY,
                                                        scale: newScale,
                                                    },
                                                }));
                                            }
                                        }}
                                        className="p-2 hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight transition duration-100 cursor-pointer"
                                    >
                                        <ArrowsExpand className="transform rotate-90" size={40} />
                                    </button>
                                </TooltipWrapper>

                                <TooltipWrapper text={t('NavigationAndCharts.TT.ResetMovement')}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTransform(0, 0, 1);
                                            dispatch(editTabProperty({ tab: currentTab, chartRotation: 0 }));
                                            dispatch(editTabProperty({ tab: currentTab, chartPosition: { ...chartPosition, positionX: 0, positionY: 0, scale: 1 } }));
                                        }}
                                        className="p-2 hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight transition duration-100 cursor-pointer"
                                    >
                                        <XCircleFill size={40} />
                                    </button>
                                </TooltipWrapper>

                                <TooltipWrapper text={t('NavigationAndCharts.TT.ZoomIn')}>
                                    <button
                                        type="button"
                                        onClick={() => zoomIn()}
                                        className="p-2 hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight transition duration-100 cursor-pointer"
                                    >
                                        <Plus size={40} />
                                    </button>
                                </TooltipWrapper>

                                <TooltipWrapper text={t('NavigationAndCharts.TT.ZoomOut')}>
                                    <button
                                        type="button"
                                        onClick={() => zoomOut()}
                                        className="p-2 hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight transition duration-100 cursor-pointer"
                                    >
                                        <Dash size={40} />
                                    </button>
                                </TooltipWrapper>
                            </div>
                            <div className="flex overflow-hidden flex-col rounded-md">
                                <div
                                    className="p-2 hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight rounded-md transition duration-100 cursor-pointer"
                                    onClick={() => {
                                        dispatch(editTabProperty({ tab: currentTab, isFullScreen: !isFullScreen }));
                                        if (chartRef.current && ref.current) {
                                            setTransform(0, 0, 1);
                                            dispatch(editTabProperty({ tab: currentTab, chartPosition: { ...chartPosition, positionX: 0, positionY: 0, scale: 1 } }));
                                        }
                                    }}
                                >
                                    {isFullScreen
                                        ? <FullscreenExit size={40} />
                                        : <ArrowsFullscreen size={40} />}
                                </div>

                                {provider === 'NAVIGRAPH' && (
                                    <div
                                        className="p-2 mt-3 hover:text-theme-body bg-theme-secondary hover:bg-theme-highlight rounded-md transition duration-100 cursor-pointer"
                                        onClick={() => dispatch(setUsingDarkTheme(!usingDarkTheme))}
                                    >
                                        {!usingDarkTheme ? <MoonFill size={40} /> : <SunFill size={40} />}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div
                            className="flex overflow-x-hidden overflow-y-scroll relative flex-row mx-auto h-full bg-theme-accent rounded-lg grabbable no-scrollbar"
                            ref={ref}
                        >
                            <TransformComponent wrapperStyle={{ height: ref.current?.clientHeight, width: ref.current?.clientWidth }}>
                                {/* <DrawableCanvas */}
                                {/*    className="absolute inset-0 z-10 transition duration-100" */}
                                {/*    rotation={chartRotation} */}
                                {/*    brushSize={brushSize} */}
                                {/*    width={chartDimensions.width ?? 0} */}
                                {/*    height={chartDimensions.height ?? 0} */}
                                {/*    resolutionScalar={4} */}
                                {/*    disabled={!drawMode} */}
                                {/* /> */}

                                <div
                                    className="relative m-auto transition duration-100"
                                    style={{ transform: `rotate(${chartRotation}deg)` }}
                                >
                                    {(chartLinks && provider === 'NAVIGRAPH') && (
                                        <p
                                            className="absolute top-0 left-0 font-bold text-theme-highlight whitespace-nowrap transition duration-100 transform -translate-y-full"
                                        >
                                            This chart is linked to
                                            {' '}
                                            {userName}
                                        </p>
                                    )}

                                    { (aircraftIconVisible && boundingBox) && (
                                        <svg ref={planeRef} viewBox={`0 0 ${boundingBox.width} ${boundingBox.height}`} className="absolute top-0 left-0 z-30">
                                            <g
                                                className="transition duration-100"
                                                transform={`translate(${aircraftIconPosition.x} ${aircraftIconPosition.y}) rotate(${aircraftIconPosition.r})`}
                                                strokeLinecap="square"
                                            >
                                                <path d="M-20,0 L20,0" stroke="black" strokeWidth="7" />
                                                <path d="M-10,20 L10,20" stroke="black" strokeWidth="7" />
                                                <path d="M0,-10 L0,30" stroke="black" strokeWidth="7" />
                                                <path d="M-20,0 L20,0" stroke="yellow" strokeWidth="5" />
                                                <path d="M-10,20 L10,20" stroke="yellow" strokeWidth="5" />
                                                <path d="M0,-10 L0,30" stroke="yellow" strokeWidth="5" />
                                            </g>
                                        </svg>
                                    )}

                                    <div ref={chartRef}>
                                        <img
                                            className="absolute left-0 w-full transition duration-100 select-none"
                                            draggable={false}
                                            src={chartLinks.dark}
                                            alt="chart"

                                        />
                                        <img
                                            className={`absolute left-0 w-full transition duration-100 select-none ${usingDarkTheme && 'opacity-0'}`}
                                            draggable={false}
                                            src={chartLinks.light}
                                            alt="chart"
                                        />
                                    </div>
                                </div>
                            </TransformComponent>
                        </div>
                    </div>
                )}
            </TransformWrapper>
        </div>
    );
};
